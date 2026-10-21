# vendor

`repcast-movement-<commit>.tgz` is the rep engine ([repcast-movement](https://github.com/Mallikarjuntr/repcast-movement)) at that commit, built and packed with `npm pack`. The camera app depends on this file instead of the GitHub repo so that `npm ci` works on every npm version: npm 12 refuses git dependencies and install scripts by default, and a git install of the engine needs both (its `prepare` script builds `dist/`).

To update it after an engine change (engine checkout next to this repo):

```bash
cd ../repcast-movement && npm pack --pack-destination ../repcast-tv-app/vendor
cd ../repcast-tv-app/vendor && mv repcast-movement-0.1.0.tgz repcast-movement-$(git -C ../../repcast-movement rev-parse --short HEAD).tgz
cd .. && npm install ./vendor/repcast-movement-<commit>.tgz -w apps/camera   # then delete the old .tgz
```
