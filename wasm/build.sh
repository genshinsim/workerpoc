#!/usr/bin/env bash

GOOS=js GOARCH=wasm go build -o main.wasm
mv main.wasm ../app/
