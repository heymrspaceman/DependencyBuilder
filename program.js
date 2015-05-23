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

// Component Constructor
function Reference(element) {
	this.id = element.trim();
}

Reference.prototype.copy = function()
{
	var newReference = new Reference("");
	newReference.id = this.id;
	
	return newReference;
}

// export the class
module.exports = Reference;

// Component Constructor
function Component(splitData) {
  
  this.destinationFolder = "";
  if (splitData.length > 0)
  {
	  this.id = splitData[0];
	  if (splitData.length > 1)
	  { 
		  var source = splitData[1];
		  if (source.indexOf("\\\\") > 0)
		  {
		  	console.log("-----" + source);
			  source = source.replace("\\\\",":\\");
			  this.fullPath = true;
		  }
		  else
		  {				  	
			  this.fullPath = false;
		  }
		  this.source = source;
		  		  
		  // Extract the filename from the full artifact path, note the file may not exist at this point in time
		  // so we cannot use fs.stat
		  var sourceSplit = this.source.split("\\");	
		  this.sourceFilenameOnly = sourceSplit[sourceSplit.length - 1];
		  
		  if (splitData.length > 2)
		  {
			  console.log("Unexpected split length " + splitData.length + " for " + this.id);
			  this.destinationFolder = splitData[2];
			  
			  if (splitData.length > 3)
			  {				 
				  this.alternativeSource = splitData[3].replace("\\\\",":\\");;
				  if (splitData.length > 4)
				  {				 
					  this.register = true;
				  }
				  else
				  {
				  	this.register = false;
				  }
			  }
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
	newComponent.destinationFolder = this.destinationFolder;
	
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
		copy = copy + "\tcopy /Y \"%param1%\\dependencies_svn\\dlls\\internal\\" + this.destinationFolder + this.sourceFilenameOnly + "\" \"%param2%\"\r\n";
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
		// artifactFullPath is from the root folder of the project, however this is run from within the Setups folder
		// so add a ..\
		artifactFullPath = "..\\" + artifactFullPath;
		include = include + "#ifexist \"" + artifactFullPath + "\"\r\n";
		include = include + "\tSource: \"" + artifactFullPath + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
		include = include + "#else\r\n";
		include = include + "\tSource: \"..\\dependencies_svn\\dlls\\internal\\" + this.destinationFolder + this.sourceFilenameOnly + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
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

// At the moment this only handles one file per external
Component.prototype.GenerateExternalIssCopy = function()
{
	var destinationFolder = "";
	if (this.destinationFolder.length > 0)
	{
		destinationFolder = "\\" + this.destinationFolder;
	}
	
	var sourcePath = "\"..\\Dependencies_svn\\dlls\\external\\" + this.source;
	if (this.fullPath)
	{
		sourcePath = "\"" + this.source;
	}
	
	var register = "";
	if (this.register)
	{
		register = " regserver 32bit";
	}
	
	if (this.alternativeSource !== undefined)
	{
		if (this.alternativeSource.length > 0)
		{
			var include = "";
		// artifactFullPath is from the root folder of the project, however this is run from within the Setups folder
		// so add a ..\
			var altSourcePath = "..\\" + this.alternativeSource;
			include = include + "#ifexist \"" + altSourcePath + "\"\r\n";
			include = include + "\tSource: \"" + altSourcePath + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
			include = include + "#else\r\n";
			include = include + "\tSource: " + sourcePath + "\"; DestDir: \"{app}\\{#DestSubDir}" + destinationFolder + "\"; Flags: ignoreversion\r\n";
			include = include + "#endif\r\n";
			
			return include;
		}
	}
	
	return "Source: " + sourcePath + "\"; DestDir: \"{app}\\{#DestSubDir}" + destinationFolder + "\"; Flags: ignoreversion" + register + "\r\n";
}

// class methods
Component.prototype.fooBar = function() {

};
// export the class
module.exports = Component;

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
		reference = new Reference(element);
		if (internalBelongsTo[reference.id] !== undefined)
		{
			// This belongsTo can be used for CruiseControl
			//console.log("[" + belongsTo[reference]  +"] " + reference);
			references.push(reference);
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
		
	internalDepencencies.forEach(function(ref) {
		fileContents = fileContents + "#include \"" + ref.id + "_dependencies.iss\"\r\n";
	}, this);
		
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
	
	fs.writeFile(filename, fileContents);
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
		
	dependencies.forEach(function(ref) {
		fileContents = fileContents + "Call \"%param1%\\dependencies_svn\\scripts\\postbuild\\CopyDependenciesInternal";
		fileContents = fileContents + ref.id + ".bat\" \"%param1%\" \"%param2%\" \"%param3%\"\r\n";
		fileContents = fileContents + "if errorlevel 1 echo \"Error in %0\" exit\r\n";
	}, this);
		
	filename = path.join(postBuildBatchFilesDir, filename);
	
	fs.writeFile(filename, fileContents);
}