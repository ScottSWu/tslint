---
layout: page
title: Library
permalink: /usage/library/
---

### Installation ###
------------

```
npm install tslint
npm install typescript
```

{% include peer_dependencies.md %}

### Usage ###
-----

Please ensure that the TypeScript source files compile correctly _before_ running the linter.


```ts
var fileName = "Specify file name";

var configuration = {
    rules: {
        "variable-name": true,
        "quotemark": [true, "double"]
    }
};

var options = {
    formatter: "json",
    configuration: configuration,
    rulesDirectory: "customRules/", // can be an array of directories
    formattersDirectory: "customFormatters/"
};

var Linter = require("tslint");
var fs = require("fs");
var contents = fs.readFileSync(fileName, "utf8");

var ll = new Linter(fileName, contents, options);
var result = ll.lint();
```

### Type Checking ###
-----

To enable rules that work with the type checker, a program object can be passed to the linter. The program object can be created with helper functions.


```ts
var program = Linter.createProgram("tsconfig.json", "projectDir/");
ts.getPreEmitDiagnostics(program);
var files = Linter.getFileNames(program);

var results = files.map(file => new Linter(file,
    program.getSourceFile(file).getFullText(), program.lint()));
```
