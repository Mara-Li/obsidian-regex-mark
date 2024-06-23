## [1.7.0](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.6.4...1.7.0) (2024-06-23)
### Features

* allow to hide per view mode (reading, source & LP) ([01f3da3](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/01f3da397d9be556981421a618d7def2f8b6c7bf))

### Bug Fixes

* new regex disabled ([927a306](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/927a30616ae67ef605319670c015d87b331cde17))
* structured clone + styles ([a6f7536](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/a6f7536de58bbcf95b8bb4b5504cfd4e5e5a7a59))

## [1.6.3](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.6.2...1.6.3) (2024-06-08)
### Bug Fixes

* temp fix to exclude regex that can match newline ([9b37f64](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/9b37f64202a780321a61843dcea5651035e714d5))

## [1.6.2](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.6.1...1.6.2) (2024-06-04)
### Bug Fixes

* regex placement ([3ac4363](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/3ac4363643558525f89380bc36444a27c571f6d9))

## [1.6.1](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.6.0...1.6.1) (2024-06-04)
### Bug Fixes

* stuck on disabled even regex are valid ([06c9213](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/06c9213a3dce50a7763910471d18da7e7cf8e50f))

## [1.6.0](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.6.0-0...1.6.0) (2024-06-04)

## [1.5.3](https://github.com/Mara-Li/obsidian-regex-mark/compare/1.5.2...1.5.3) (2024-05-28)
### Bug Fixes

* remove unused css-class ([e3a5a94](https://github.com/Mara-Li/obsidian-regex-mark/commit/e3a5a948ab11df47918360ebb8d6f3d35848f837))
* set a tooltip when hide is disabled ([787fe8b](https://github.com/Mara-Li/obsidian-regex-mark/commit/787fe8b14456d4f85ec379f13d19a191ce86a5d5))

## [1.5.2](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.5.1...1.5.2) (2024-05-24)
### Bug Fixes

* avoid innerHTML and use `sanitizeHTMLToDom` instead ([fd50ce0](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/fd50ce0818beaa28e2da04ad42c2aecb3f69603e))

## [1.5.1](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.5.0...1.5.1) (2023-12-24)
### Bug Fixes

* forgot to remove logs ([bc30cb6](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/bc30cb63717a714b320274b2cfcc7ac054848e64))

## [1.5.0](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.4.2...1.5.0) (2023-12-22)
### Features

* allow table and callout title to be rendered too ([c01456c](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/c01456cb74542ad92438771e21ebb202671b3ac8))

## [1.4.2](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.4.1...1.4.2) (2023-12-22)
### Bug Fixes

* allow table ([d012425](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/d012425758007362d8c1570d6235f21f9f46431a))

## [1.4.1](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.4.0...1.4.1) (2023-12-03)
### Bug Fixes

* all regex without close/open return null ([4364939](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/436493969e9e37f66e3417871892f059ea342f17))
* allow to have markup in heading ([5a544db](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/5a544db8a34bcf423998f43998f44b657d5eb0dc))

## [1.4.0](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.3.0...1.4.0) (2023-12-03)
### Features

* prevent regex with \} as they are wrongly parsed ([162493a](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/162493a88ec7ae7717afd3d133462df48f23edbd))

## [1.3.0](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.2.2...1.3.0) (2023-12-02)
### Features

* add support for "li" ! ([7f36774](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/7f36774068a39f1a3dbd1e7f3245ce38ba4fbc7c))

## [1.2.2](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.2.1...1.2.2) (2023-11-30)
### Bug Fixes

* better message ([c4efca2](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/c4efca27e2dd5f2479e0e8b00e7be85772df03e8))
* prevent duplicate regex ([4763186](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/47631861dbe66eabddb514d56ed1668970c31b8b))

## [1.2.1](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.2.0...1.2.1) (2023-11-30)
### Bug Fixes

* disable toggle if regex is invalid ([d90cb4c](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/d90cb4c434318a15ad6b9cfbc358588e0ed0d990))

## [1.2.0](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.1.6...1.2.0) (2023-11-29)
### Features

* reload extension when settings change ([f35c5b9](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/f35c5b95a8c62e9aa86fd92723b6699d34ca910c))

## [1.1.6](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.1.5...1.1.6) (2023-11-29)

## [1.1.5](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.1.4...1.1.5) (2023-11-29)
### Bug Fixes

* cursor bug (again) ([add93b2](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/add93b2d5b98b89e75ed5680d1dbec5a1c16e920))

## [1.1.4](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.1.3...1.1.4) (2023-11-29)

## [1.1.3](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.1.2...1.1.3) (2023-11-29)

## [1.1.2](https://github.com/Lisandra-dev/obsidian-regex-mark/compare/1.1.1...1.1.2) (2023-11-29)
### Bug Fixes

* error in cursor position ([1671349](https://github.com/Lisandra-dev/obsidian-regex-mark/commit/167134943d270906e9de900a2b84252dedc32271))