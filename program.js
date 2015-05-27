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
		
	CreateIssDependencyScript(component, references, internalExtraReferences, externalReferences);
	CreatePostBuildBatchFile(component, references, internalExtraReferences);
}


function CreateIssDependencyScript(component, internalDepencencies, internalExtraDependencies, externalDependencies)
{
	var filename = component + "_dependencies.iss";
	var fileContents = "[Files]\r\n;Internal\r\n";
	var originalScript = false;
	
	// Build artifacts
	var fetchedComponents = internalComponentsPath[component];
		
	if (fetchedComponents !== undefined)
	{
		fetchedComponents.forEach(function(fetchedComponent) {
			originalScript = originalScript || fetchedComponent.original;
			fileContents = fileContents + fetchedComponent.GenerateArtifactInclude(fetchedComponent.source) + "\r\n";
		}, this);
	}
	else
	{
		fileContents = fileContents + "\r\n";
	}
	
	if (!originalScript)
	{			
		internalDepencencies.forEach(function(ref) {
			fileContents = fileContents + "#include \"" + ref.id + "_dependencies.iss\"\r\n";
		}, this);
			
		if (internalExtraDependencies.length > 0) {
			fileContents = fileContents + "\r\n;Internal but not referenced in Visual Studio\r\n";
			internalExtraDependencies.forEach(function(extraRef) {			
				var internalComponents = internalComponentsPath[extraRef.id];
				var scriptFolder = "";
				if (internalComponents !== undefined)
				{
					internalComponents.forEach(function(internalComponent) {
						if (internalComponent.original)
						{
							scriptFolder = "originals\\";
						}
					}, this);
				}
				
				fileContents = fileContents + "#include \"" + scriptFolder + extraRef.id + "_dependencies.iss\"\r\n";			
			}, this);
		}
			
		if (externalDependencies.length > 0) {
			fileContents = fileContents + "\r\n;External";
			externalDependencies.forEach(function(ref) {
				var externalComponents = externalComponentsPath[ref.id];
				if (externalComponents !== undefined)
				{
					fileContents = fileContents + "\r\n;" + ref.id + "\r\n";
					externalComponents.forEach(function(externalComponent) {
						fileContents = fileContents + externalComponent.GenerateExternalIssCopy();
					}, this);
				}
			}, this);
		}
		
		filename = path.join(scriptsDir, filename);
		fs.writeFile(filename, fileContents);
	}
}

function CreatePostBuildBatchFile(component, dependencies, internalExtraDependencies)
{
	var filename = "CopyDependenciesInternal" + component +  ".bat";
	var originalBatchFile = false;
	
	var fileContents = "@echo off\r\n";
	fileContents = fileContents + "REM 2 parameters are passed in wrapped in quotes, but this causes problems when using them but putting them in variables solves it\r\n";
	fileContents = fileContents + "set param1=%~1\r\n";
	fileContents = fileContents + "set param2=%~2\r\n";
	fileContents = fileContents + "set param3=%~3\r\n";
	fileContents = fileContents + "REM echo \"*** Parameter 1 removed quotes: (%param1%)\"\r\n";
	fileContents = fileContents + "REM echo \"*** Parameter 2 removed quotes: (%param2%)\"\r\n";
	fileContents = fileContents + "\r\n";
	
	var fetchedComponents = internalComponentsPath[component];
	if (fetchedComponents !== undefined)
	{
		fetchedComponents.forEach(function(fetchedComponent) {
			originalBatchFile = originalBatchFile || fetchedComponent.original;
			fileContents = fileContents + fetchedComponent.GenerateArtifactBatchCopy();
		}, this);
	}
		
	if (!originalBatchFile)
	{
		dependencies.forEach(function(ref) {
			fileContents = fileContents + "Call \"%param1%\\dependencies_svn\\scripts\\postbuild\\CopyDependenciesInternal";
			fileContents = fileContents + ref.id + ".bat\" \"%param1%\" \"%param2%\" \"%param3%\"\r\n";
			fileContents = fileContents + "if errorlevel 1 echo \"Error in %0\" exit\r\n";
		}, this);
		
		if (internalExtraDependencies.length > 0)
		{
			fileContents = fileContents + "\r\nREM Internal but not referenced in Visual Studio\r\n";
			internalExtraDependencies.forEach(function(ref) {
				fileContents = fileContents + "Call \"%param1%\\dependencies_svn\\scripts\\postbuild\\CopyDependenciesInternal";
				fileContents = fileContents + ref.id + ".bat\" \"%param1%\" \"%param2%\" \"%param3%\"\r\n";
				fileContents = fileContents + "if errorlevel 1 echo \"Error in %0\" exit\r\n";
			}, this);
		}
			
		filename = path.join(postBuildBatchFilesDir, filename);	
		fs.writeFile(filename, fileContents);
	}
}