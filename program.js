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
var path = require('path');
var async = require('async');
var projectComponent = require("./projectComponent.js");
var projectReference = require("./projectReference.js");
var innoScript = require("./innoScript.js");
var postBuildBatchFile = require("./postBuildBatchFile.js");

var internalBelongsTo = [];
var externalBelongsTo = [];
var internalComponentsPath = [];
var externalComponentsPath = [];
var rootDir = "D:\\nodejs\\DependencyBuilder";
var internalComponentsDir = path.join(rootDir, "Dependencies\\Components");
var externalComponentsDir = path.join(rootDir, "Dependencies\\Components\\external");
var referencesDir = path.join(rootDir, "Dependencies\\References");
var scriptsDir = path.join(rootDir, "Dependencies\\Generated scripts");
var postBuildBatchFilesDir = path.join(rootDir, "Dependencies\\Generated scripts\\postbuild");

// TODO Delete all previous audo generated scripts
//fs.mkdirSync(scriptsDir);
//fs.mkdirSync(postBuildBatchFilesDir);

fs.readdir(internalComponentsDir, function(err, internalFiles)
{
	ReadComponents(internalComponentsDir, internalFiles, ProcessInternalComponent);	
	
	fs.readdir(externalComponentsDir, function(err, files)
	{
		ReadComponents(externalComponentsDir, files, ProcessExternalComponent);	
	});
	
	// Synchronous forEachs will have all finished by now	
	fs.readdir(referencesDir, function(err, solutionDirs)
	{	
		for (var i = 0; i < solutionDirs.length; i++) {			
			ReadSolutionDir(path.join(referencesDir, solutionDirs[i]));			
		}
	});
});

function ProcessInternalComponent(file, elementSplit)
{
	var project = elementSplit[0];
	var internalComponent = new projectComponent(elementSplit);
	
	internalBelongsTo[project] = file;
	if (elementSplit.length > 1)
	{
		// Add this to the list of components
		if (internalComponentsPath[project] == undefined)
		{
			internalComponentsPath[project] = [];
		}
		internalComponentsPath[project].push(internalComponent);
	}
}

function ProcessExternalComponent(file, elementSplit)
{
	var project = elementSplit[0];
	var externalComponent = new projectComponent(elementSplit);
	
	externalBelongsTo[project] = file;
	if (elementSplit.length > 1)
	{
		// Add this to the list of components
		if (externalComponentsPath[project] == undefined)
		{
			externalComponentsPath[project] = [];
		}
		externalComponentsPath[project].push(externalComponent);
	}
}

function ReadComponents(componentsDir, files, ProcessComponent)
{
	//forEach are synchronous
	files.forEach(function(file) {
		var fullPath = path.join(componentsDir, file);
		
		if (!fs.statSync(fullPath).isDirectory())
		{
			var fileContents = fs.readFileSync(fullPath, 'UTF-8');
	
			fileContents.split(',').forEach(function(element) {
				// Each component is split into the project name and the actual path to the artifact
				var elementSplit = element.trim().split(":");
				
				ProcessComponent(file, elementSplit);
			}, this);
		}
	}, this);
}

function ReadSolutionDir(solutionDir)
{
	if (fs.statSync(solutionDir).isDirectory())
	{
		fs.readdir(solutionDir, function(err, projectFiles)
		{
			for (var i = 0; i < projectFiles.length; i++) {			
				ReadProjectDir(path.join(solutionDir, projectFiles[i]), projectFiles[i]);			
			}
		});	
	}
}

function ReadProjectDir(projectFile, bottomDir)
{
	var component = bottomDir.replace(".txt", "");
	console.log("Processing " + component);
	
	var referenceFileContents = fs.readFileSync(projectFile, 'UTF-8');
	var reference = "";
	var references = [];		
	var externalReferences = [];
	var internalExtraReferences = [];			
	referenceFileContents.split(',').forEach(function(element) {
		reference = new projectReference(element);
		if (internalBelongsTo[reference.id] !== undefined)
		{
			// This belongsTo can be used for CruiseControl
			//console.log("[" + belongsTo[reference]  +"] " + reference);
			if (reference.referenced)
			{
				references.push(reference);
			}
			else
			{
				internalExtraReferences.push(reference);
			}
		}
		else
		{
			// Check external refernces
			if (externalBelongsTo[reference.id] !== undefined)
			{
				externalReferences.push(reference);
			}
			else
			{
				console.log("reference not found: " + reference.id);
			}
		}
	}, this);
		
	var componentInnoScript = new innoScript();
	componentInnoScript.CreateIssDependencyScript(component, references, internalExtraReferences, externalReferences, internalComponentsPath, externalComponentsPath, scriptsDir);
	
	var componentBatchFile = new postBuildBatchFile();
	componentBatchFile.CreatePostBuildBatchFile(component, references, internalExtraReferences, internalComponentsPath, externalComponentsPath, postBuildBatchFilesDir);
}