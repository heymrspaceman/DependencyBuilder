/// <reference path="typings/node/node.d.ts"/>

// For each project we will read a components CSV file

// For component we will read a references scv file

// We will create
// Inno setup include scripts
// Batch files
// Basic graph of dependencies
// Perhaps something CruiseControl can read

// Directory will be in the run folder at the moment
// Dependencies/Components

var fs = require('fs');
var componentFilename = 'C:\\nodejs\\DependencyBuilder\\Dependencies\\Components\\AdminTool.txt';
var fileContents = fs.readFileSync(componentFilename, 'UTF-8');

console.log(fileContents);
console.log("--------------");
fileContents.split(',').forEach(function(element) {
	console.log(" " + element);
}, this);