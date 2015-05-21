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
	
	internalBelongsTo[project] = file;
	if (elementSplit.length > 1)
	{
		// Add this to the list of components
		if (internalComponentsPath[project] == undefined)
		{
			internalComponentsPath[project] = [];
		}
		internalComponentsPath[project].push(elementSplit[1]);
	}
}

function ProcessExternalComponent(file, elementSplit)
{
	var project = elementSplit[0];
	
	externalBelongsTo[project] = file;
	if (elementSplit.length > 1)
	{
		// Add this to the list of components
		if (externalComponentsPath[project] == undefined)
		{
			externalComponentsPath[project] = [];
		}
		externalComponentsPath[project].push(elementSplit[1]);
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

function GetArtifact(component)
{
	if (internalComponentsPath[component] !== undefined)
	{
		return internalComponentsPath[component][0];
	}
	
	return undefined;
}

function CreateIssDependencyScript(component, internalDepencencies, externalDependencies)
{
	var filename = component + "_dependencies.iss";
	var fileContents = "[Files]\r\n;Internal\r\n";
	filename = path.join(scriptsDir, filename);
	
	// Build artifacts
	var artifact = GetArtifact(component);
	
	var artifactsIncludes = GenerateArtifactInclude(artifact);
	
	// If there is a .exe present, then get the .exe.config also
	if ((path.extname(artifact)) == ".exe")
	{
		artifactsIncludes = artifactsIncludes + "\r\n" + GenerateArtifactInclude(artifact + ".config");
	}
	// Add artifacts here
	fileContents = fileContents + artifactsIncludes + "\r\n";
		
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
		issCopy = issCopy + "Source: \"..\\Dependencies_svn\\dlls\\external\\" + file + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
	}, this);
	return issCopy;
}

// TODO refactor this with GenerateArtifactBatchCopy
function GenerateArtifactInclude(artifactFullPath)
{
	var include = "";

	if (artifactFullPath !== undefined)
	{	
		// Extract the filename from the full artifact path, note the file may not exist at this point in time
		// so we cannot use fs.stat
		var artifactSplit = artifactFullPath.split("\\");	
		var artifactFilename = artifactSplit[artifactSplit.length - 1];
		
		// artifactFaullPath is from the root folder of the project, however this is run from within the Setups folder
		// so add a ..\
		artifactFullPath = "..\\" + artifactFullPath;
		include = include + "#ifexist \"" + artifactFullPath + "\"\r\n";
		include = include + "\tSource: \"" + artifactFullPath + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
		include = include + "#else\r\n";
		include = include + "\tSource: \"..\\dependencies_svn\\dlls\\internal\\" + artifactFilename + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
		include = include + "#endif\r\n";
	}
	
	return include;
}

function CreatePostBuildBatchFile(component, dependencies)
{
	var artifact = GetArtifact(component);
	var filename = "CopyDependenciesInternal" + component +  ".bat";
	
	var fileContents = "@echo off\r\n";
	fileContents = fileContents + "REM 2 parameters are passed in wrapped in quotes, but this causes problems when using them but putting them in variables solves it\r\n";
	fileContents = fileContents + "set param1=%~1\r\n";
	fileContents = fileContents + "set param2=%~2\r\n";
	fileContents = fileContents + "set param3=%~3\r\n";
	fileContents = fileContents + "REM echo \"*** Parameter 1 removed quotes: (%param1%)\"\r\n";
	fileContents = fileContents + "REM echo \"*** Parameter 2 removed quotes: (%param2%)\"\r\n";
	fileContents = fileContents + "\r\n";
	fileContents = fileContents + GenerateArtifactBatchCopy(artifact);
		
	dependencies.forEach(function(dep) {
		fileContents = fileContents + "Call \"%param1%\\dependencies_svn\\scripts\\postbuild\\CopyDependenciesInternal";
		fileContents = fileContents + dep + ".bat\" \"%param1%\" \"%param2%\" \"%param3%\"\r\n";
		fileContents = fileContents + "if errorlevel 1 echo \"Error in %0\" exit\r\n";
	}, this);
		
	filename = path.join(postBuildBatchFilesDir, filename);
	
	fs.writeFile(filename, fileContents);
}

// TODO refactor this with GenerateArtifactInclude
function GenerateArtifactBatchCopy(artifactFullPath)
{
	var copy = "";

	if (artifactFullPath !== undefined)
	{	
		// Extract the filename from the full artifact path, note the file may not exist at this point in time
		// so we cannot use fs.stat
		var artifactSplit = artifactFullPath.split("\\");	
		var artifactFilename = artifactSplit[artifactSplit.length - 1];
		// Replace any exlpicit Release directory with param3
		artifactFullPath = artifactFullPath.replace("Release", "%param3%");
		
		copy = copy + "if not exist \"%param1%\\" + artifactFullPath + "\" (\r\n";
		copy = copy + "\tcopy /Y \"%param1%\\dependencies_svn\\dlls\\internal\\" + artifactFilename + "\" \"%param2%\"\r\n";
		copy = copy + "\tif errorlevel 1 echo \"Error in %0\" exit\r\n";
		copy = copy + ")\r\n";
		copy = copy + "\r\n";		
	}
	
	return copy;
}