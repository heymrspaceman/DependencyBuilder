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

// Constructor
function Component(splitData) {
  // always initialize all instance properties
  //this.bar = bar;
  //this.baz = 'baz'; // default value
  
  if (splitData.length > 0)
  {
	  this.id = splitData[0];
	  if (splitData.length > 1)
	  {
		  this.source = splitData[1];
		  		  
		  // Extract the filename from the full artifact path, note the file may not exist at this point in time
		  // so we cannot use fs.stat
		  var sourceSplit = this.source.split("\\");	
		  this.sourceFilenameOnly = sourceSplit[sourceSplit.length - 1];
		  
		  if (splitData.length > 2)
		  {
			  console.log("Unexpected split length " + splitData.length + " for " + this.id);
			  this.alternativeSource = splitData[2];
		  }
	  }
  }  
}

Component.prototype.copy = function()
{
	var newComponent = new Component("");
	newComponent.source = this.source;
	newComponent.sourceFilenameOnly = this.sourceFilenameOnly;
	newComponent.alternativeSource = this.alternativeSource;
	
	return newComponent;
}

// TODO refactor this with GenerateArtifactInclude
Component.prototype.GenerateArtifactBatchCopy = function()
{
	var copy = "";
	var batchSource = this.source;

	if (batchSource !== undefined)
	{	
		// Replace any exlpicit Release directory with param3
		batchSource = batchSource.replace("Release", "%param3%");
		
		copy = copy + "if not exist \"%param1%\\" + batchSource + "\" (\r\n";
		copy = copy + "\tcopy /Y \"%param1%\\dependencies_svn\\dlls\\internal\\" + this.sourceFilenameOnly + "\" \"%param2%\"\r\n";
		copy = copy + "\tif errorlevel 1 echo \"Error in %0\" exit\r\n";
		copy = copy + ")\r\n";
		copy = copy + "\r\n";		
	}
	
	return copy;
}

// TODO refactor this with GenerateArtifactBatchCopy
Component.prototype.GenerateArtifactInclude = function()
{
	var include = "";
	var artifactFullPath = this.source;

	if (artifactFullPath !== undefined)
	{			
		// artifactFaullPath is from the root folder of the project, however this is run from within the Setups folder
		// so add a ..\
		artifactFullPath = "..\\" + artifactFullPath;
		include = include + "#ifexist \"" + artifactFullPath + "\"\r\n";
		include = include + "\tSource: \"" + artifactFullPath + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
		include = include + "#else\r\n";
		include = include + "\tSource: \"..\\dependencies_svn\\dlls\\internal\\" + this.sourceFilenameOnly + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
		include = include + "#endif\r\n";
	}
				
	if ((path.extname(artifactFullPath)) == ".exe")
	{
		var configComponent = this.copy();
		configComponent.source = configComponent.source + ".config";
		configComponent.sourceFilenameOnly = configComponent.sourceFilenameOnly + ".config";
		include = include + "\r\n" + configComponent.GenerateArtifactInclude();
	}
	
	return include;
}

// class methods
Component.prototype.fooBar = function() {

};
// export the class
module.exports = Component;

// TODO Delete all previous audo generated scripts
//fs.mkdirSync(scriptsDir);
//fs.mkdirSync(postBuildBatchFilesDir);
// constructor call
var object = new Component('Hello');
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
	var internalComponent = new Component(elementSplit);
	
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
	var externalComponent = new Component(elementSplit);
	
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
	referenceFileContents.split(',').forEach(function(element) {
		reference = element.trim();
		if (internalBelongsTo[reference] !== undefined)
		{
			// This belongsTo can be used for CruiseControl
			//console.log("[" + belongsTo[reference]  +"] " + reference);
			references.push(reference);
		}
		else
		{
			// Check external refernces
			if (externalBelongsTo[reference] !== undefined)
			{
				externalReferences.push(reference);
			}
			else
			{
				console.log("reference not found: " + reference);
			}
		}
	}, this);
		
	CreateIssDependencyScript(component, references, externalReferences);
	CreatePostBuildBatchFile(component, references);
}


function CreateIssDependencyScript(component, internalDepencencies, externalDependencies)
{
	var filename = component + "_dependencies.iss";
	var fileContents = "[Files]\r\n;Internal\r\n";
	filename = path.join(scriptsDir, filename);
	
	// Build artifacts
	var fetchedComponents = internalComponentsPath[component];
		
	if (fetchedComponents !== undefined)
	{
		fetchedComponents.forEach(function(fetchedComponent) {
			fileContents = fileContents + fetchedComponent.GenerateArtifactInclude(fetchedComponent.source) + "\r\n";
		}, this);
	}
	else
	{
		fileContents = fileContents + "\r\n";
	}
		
	internalDepencencies.forEach(function(dep) {
		fileContents = fileContents + "#include \"" + dep + "_dependencies.iss\"\r\n";
	}, this);
		
	if (externalDependencies.length > 0) {
		fileContents = fileContents + "\r\n;External";
		externalDependencies.forEach(function(dep) {
			fileContents = fileContents + GenerateExternalIssCopy(dep, externalComponentsPath[dep]);
		}, this);
	}
	
	fs.writeFile(filename, fileContents);
}

// At the moment this only handles one file per external
function GenerateExternalIssCopy(dep, files)
{
	var issCopy = "\r\n;" + dep + "\r\n";
	files.forEach(function(file) {
		issCopy = issCopy + "Source: \"..\\Dependencies_svn\\dlls\\external\\" + file.source + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
	}, this);
	return issCopy;
}

function CreatePostBuildBatchFile(component, dependencies)
{
	var filename = "CopyDependenciesInternal" + component +  ".bat";
	
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
			fileContents = fileContents + fetchedComponent.GenerateArtifactBatchCopy();
		}, this);
	}
		
	dependencies.forEach(function(dep) {
		fileContents = fileContents + "Call \"%param1%\\dependencies_svn\\scripts\\postbuild\\CopyDependenciesInternal";
		fileContents = fileContents + dep + ".bat\" \"%param1%\" \"%param2%\" \"%param3%\"\r\n";
		fileContents = fileContents + "if errorlevel 1 echo \"Error in %0\" exit\r\n";
	}, this);
		
	filename = path.join(postBuildBatchFilesDir, filename);
	
	fs.writeFile(filename, fileContents);
}