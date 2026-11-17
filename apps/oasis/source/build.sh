#!/bin/sh
# Construit le dossier statique dist/ (compatible GitHub Pages)
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/source
./node_modules/.bin/esbuild src/main.js --bundle --format=esm --minify --target=es2020,safari15 --outfile=dist/main.js --legal-comments=none
cp index.html style.css dist/
cp -r src dist/source/src
cp build.sh dist/source/
