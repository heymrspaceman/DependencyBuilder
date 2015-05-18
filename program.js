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
var fileContents = ""
var belongsTo = [];
var componentsPath = [];
var project = "";
var componentsDir = "D:\\nodejs\\DependencyBuilder\\Dependencies\\Components";
var referencesDir = "D:\\nodejs\\DependencyBuilder\\Dependencies\\References";
var scriptsDir = "D:\\nodejs\\DependencyBuilder\\Dependencies\\Generated scripts";
var postBuildBatchFilesDir = "D:\\nodejs\\DependencyBuilder\\Dependencies\\Generated scripts\\postbuild";

// TODO Delete all previous audo generated scripts
//fs.mkdirSync(scriptsDir);
//fs.mkdirSync(postBuildScriptsDir);

fs.readdir(componentsDir, function(err, files)
{
	//forEach are synchronous
	files.forEach(function(file) {
		console.log("-" + file);		

		fileContents = fs.readFileSync(path.join(componentsDir, file), 'UTF-8');
		fileContents.split(',').forEach(function(element) {
			// Each component is split into the projec name and the actual path to the artifact
			var elementSplit = element.trim().split(":");
			
			project = elementSplit[0];
			
			belongsTo[project] = file;
			if (elementSplit.length > 1)
			{
				componentsPath[project] = elementSplit[1];
			}
			console.log(project + " from " + file);
		}, this);
	}, this);
	
	// Synchronous forEachs will have all finished by now
	
	fs.readdir(referencesDir, function(err, solutionDirs)
	{	
		for (var i = 0; i < solutionDirs.length; i++) {			
			ReadSolutionDir(path.join(referencesDir, solutionDirs[i]));			
		}
	})
});

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
	referenceFileContents.split(',').forEach(function(element) {
		reference = element.trim();
		if (belongsTo[reference] !== undefined)
		{
			// This belongsTo can be used for CruiseControl
			//console.log("[" + belongsTo[reference]  +"] " + reference);
			references.push(reference);
		}
	}, this);
		
	CreateIssDependencyScript(component, references);
	CreatePostBuildBatchFile(component, references);
}

function CreateIssDependencyScript(component, dependencies)
{
	var filename = component + "_dependencies.iss";
	var fileContents = "[Files]\r\n;Internal\r\n";
	filename = path.join(scriptsDir, filename);
	
	// Build artifacts
	var artifact = componentsPath[component];
	var artifactsIncludes = GenerateArtifactInclude(artifact);
	
	// If there is a .exe present, then get the .exe.config also
	if ((path.extname(artifact)) == ".exe")
	{
		artifactsIncludes = artifactsIncludes + "\r\n" + GenerateArtifactInclude(artifact + ".config");
	}
	// Add artifacts here
	fileContents = fileContents + artifactsIncludes + "\r\n";
		
	dependencies.forEach(function(dep) {
		fileContents = fileContents + "#include \"" + dep + "_dependencies.iss\"\r\n";
	}, this);
	
	fs.writeFile(filename, fileContents);
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
	var artifact = componentsPath[component];
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