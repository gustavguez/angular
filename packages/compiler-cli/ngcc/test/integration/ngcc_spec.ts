/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {existsSync, readFileSync, readdirSync, statSync} from 'fs';
import * as mockFs from 'mock-fs';
import {join} from 'path';
const Module = require('module');

import {mainNgcc} from '../../src/main';
import {getAngularPackagesFromRunfiles, resolveNpmTreeArtifact} from '../../../test/runfile_helpers';
import {AbsoluteFsPath} from '../../../src/ngtsc/path';

const NODE_MODULES = AbsoluteFsPath.from('/node_modules');

describe('ngcc main()', () => {
  beforeEach(createMockFileSystem);
  afterEach(restoreRealFileSystem);

  it('should run ngcc without errors for esm2015', () => {
    expect(() => mainNgcc({baseSourcePath: NODE_MODULES, propertiesToConsider: ['esm2015']}))
        .not.toThrow();
  });

  it('should run ngcc without errors for esm5', () => {
    expect(() => mainNgcc({baseSourcePath: NODE_MODULES, propertiesToConsider: ['esm5']}))
        .not.toThrow();
  });

  it('should only compile the given package entry-point (and its dependencies)', () => {
    mainNgcc({
      baseSourcePath: NODE_MODULES,
      targetEntryPointPath: AbsoluteFsPath.from(`${NODE_MODULES}/@angular/common/http`)
    });

    expect(loadPackage('@angular/common/http').__modified_by_ngcc__).toEqual({
      module: '0.0.0-PLACEHOLDER',
      es2015: '0.0.0-PLACEHOLDER',
      esm5: '0.0.0-PLACEHOLDER',
      esm2015: '0.0.0-PLACEHOLDER',
      fesm5: '0.0.0-PLACEHOLDER',
      fesm2015: '0.0.0-PLACEHOLDER'
    });
    expect(loadPackage('@angular/common').__modified_by_ngcc__).toEqual({
      module: '0.0.0-PLACEHOLDER',
      es2015: '0.0.0-PLACEHOLDER',
      esm5: '0.0.0-PLACEHOLDER',
      esm2015: '0.0.0-PLACEHOLDER',
      fesm5: '0.0.0-PLACEHOLDER',
      fesm2015: '0.0.0-PLACEHOLDER'
    });
    expect(loadPackage('@angular/core').__modified_by_ngcc__).toEqual({
      module: '0.0.0-PLACEHOLDER',
      es2015: '0.0.0-PLACEHOLDER',
      esm5: '0.0.0-PLACEHOLDER',
      esm2015: '0.0.0-PLACEHOLDER',
      fesm5: '0.0.0-PLACEHOLDER',
      fesm2015: '0.0.0-PLACEHOLDER'
    });
    expect(loadPackage('@angular/common/testing').__modified_by_ngcc__).toBeUndefined();
  });

  it('should only build the format properties specified for each entry-point', () => {
    mainNgcc({baseSourcePath: NODE_MODULES, propertiesToConsider: ['main', 'esm5', 'module']});

    expect(loadPackage('@angular/core').__modified_by_ngcc__).toEqual({
      esm5: '0.0.0-PLACEHOLDER',
      module: '0.0.0-PLACEHOLDER',
    });
    expect(loadPackage('@angular/common').__modified_by_ngcc__).toEqual({
      esm5: '0.0.0-PLACEHOLDER',
      module: '0.0.0-PLACEHOLDER',
    });
    expect(loadPackage('@angular/common/testing').__modified_by_ngcc__).toEqual({
      esm5: '0.0.0-PLACEHOLDER',
      module: '0.0.0-PLACEHOLDER',
    });
    expect(loadPackage('@angular/common/http').__modified_by_ngcc__).toEqual({
      esm5: '0.0.0-PLACEHOLDER',
      module: '0.0.0-PLACEHOLDER',
    });
  });
});


function createMockFileSystem() {
  mockFs({
    '/node_modules/@angular': loadAngularPackages(),
    '/node_modules/rxjs': loadDirectory(resolveNpmTreeArtifact('rxjs', 'index.js')),
    '/node_modules/tslib': loadDirectory(resolveNpmTreeArtifact('tslib', 'tslib.js')),
  });
  spyOn(Module, '_resolveFilename').and.callFake(mockResolve);
}

function restoreRealFileSystem() {
  mockFs.restore();
}


/** Load the built Angular packages into an in-memory structure. */
function loadAngularPackages(): Directory {
  const packagesDirectory: Directory = {};

  getAngularPackagesFromRunfiles().forEach(
      ({name, pkgPath}) => { packagesDirectory[name] = loadDirectory(pkgPath); });

  return packagesDirectory;
}

/**
 * Load real files from the filesystem into an "in-memory" structure,
 * which can be used with `mock-fs`.
 * @param directoryPath the path to the directory we want to load.
 */
function loadDirectory(directoryPath: string): Directory {
  const directory: Directory = {};

  readdirSync(directoryPath).forEach(item => {
    const itemPath = join(directoryPath, item);
    if (statSync(itemPath).isDirectory()) {
      directory[item] = loadDirectory(itemPath);
    } else {
      directory[item] = readFileSync(itemPath, 'utf-8');
    }
  });

  return directory;
}

interface Directory {
  [pathSegment: string]: string|Directory;
}

function mockResolve(request: string): string|null {
  if (existsSync(request)) {
    const stat = statSync(request);
    if (stat.isFile()) {
      return request;
    } else if (stat.isDirectory()) {
      const pIndex = mockResolve(request + '/index');
      if (pIndex && existsSync(pIndex)) {
        return pIndex;
      }
    }
  }
  for (const ext of ['.js', '.d.ts']) {
    if (existsSync(request + ext)) {
      return request + ext;
    }
  }
  if (request.indexOf('/node_modules') === 0) {
    // We already tried adding node_modules so give up.
    return null;
  } else {
    return mockResolve(join('/node_modules', request));
  }
}

function loadPackage(packageName: string): any {
  return JSON.parse(readFileSync(`/node_modules/${packageName}/package.json`, 'utf8'));
}