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
var rootDir = ".";
var internalComponentsJsonDir = path.join(rootDir, "Dependencies\\ComponentsJson");
var externalComponentsJsonDir = path.join(rootDir, "Dependencies\\ComponentsJson\\external");
var referencesJsonDir = path.join(rootDir, "Dependencies\\ReferencesJson");
var scriptsDir = path.join(rootDir, "Dependencies\\Generated scripts");
var postBuildBatchFilesDir = path.join(rootDir, "Dependencies\\Generated scripts\\postbuild");

// TODO Delete all previous audo generated scripts
//fs.mkdirSync(scriptsDir);
//fs.mkdirSync(postBuildBatchFilesDir);

fs.readdir(internalComponentsJsonDir, function(err, internalFiles)
{
	ReadComponents(internalComponentsJsonDir, internalFiles, ProcessInternalComponent);	
	
	fs.readdir(externalComponentsJsonDir, function(err, externalFiles)
	{
		ReadComponents(externalComponentsJsonDir, externalFiles, ProcessExternalComponent);	
	});	
	
	// Synchronous forEachs will have all finished by now	
	fs.readdir(referencesJsonDir, function(err, solutionJsonDirs)
	{	
		for (var i = 0; i < solutionJsonDirs.length; i++) {			
			ReadSolutionJsonDir(path.join(referencesJsonDir, solutionJsonDirs[i]));			
		}
	});
});

function ProcessInternalComponent(file, obj)
{
	var project = obj.name;
	
	var internalComponent = new projectComponent(obj);
	
	internalBelongsTo[project] = file;
	// Add this to the list of components
	if (internalComponentsPath[project] == undefined)
	{
		internalComponentsPath[project] = [];
	}
	internalComponentsPath[project].push(internalComponent);
}

function ProcessExternalComponent(file, obj)
{
	var project = obj.name;
	
	var externalComponent = new projectComponent(obj);
	
	externalBelongsTo[project] = file;
	// Add this to the list of components		
	if (externalComponentsPath[project] == undefined)
	{
		externalComponentsPath[project] = [];
	}
	externalComponentsPath[project].push(externalComponent);
}

function ReadComponents(componentsDir, files, ProcessComponent)
{
	//forEach are synchronous
	files.forEach(function(file) {
		var fullPath = path.join(componentsDir, file);
		
		if (!fs.statSync(fullPath).isDirectory())
		{
			var fileContents = fs.readFileSync(fullPath, 'UTF-8');
			var myJson = JSON.parse(fileContents);
				
			for (var i = 0; i < myJson.components.length; i++) {
			    ProcessComponent(file, myJson.components[i]);				
			}
		}
	}, this);
}

function ReadSolutionJsonDir(solutionDir)
{
	if (fs.statSync(solutionDir).isDirectory())
	{
		fs.readdir(solutionDir, function(err, projectFiles)
		{
			for (var i = 0; i < projectFiles.length; i++) {			
				ReadProjectJsonDir(path.join(solutionDir, projectFiles[i]), projectFiles[i]);			
			}
		});	
	}
}

function ReadProjectJsonDir(projectFile, bottomDir)
{	
	var component = bottomDir.replace(".json", "");
	
	var referenceFileContents = fs.readFileSync(projectFile, 'UTF-8');
	var myJson = JSON.parse(referenceFileContents);
	var reference = "";
	var references = [];		
	var externalReferences = [];
	var internalExtraReferences = [];	
	var jsonReferences = [];	
	
	for (var i = 0; i < myJson.references.length; i++) {
		reference = new projectReference(myJson.references[i]);
		jsonReferences.push(reference);
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
	}
		
	var componentInnoScript = new innoScript();
	componentInnoScript.CreateIssDependencyScript(component, references, internalExtraReferences, externalReferences, internalComponentsPath, externalComponentsPath, scriptsDir);
	
	var componentBatchFile = new postBuildBatchFile(postBuildBatchFilesDir, component);
	componentBatchFile.CreatePostBuildBatchFile(component, references, internalExtraReferences, internalComponentsPath, externalComponentsPath);
}