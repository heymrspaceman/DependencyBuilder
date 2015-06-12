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
var projectComponent = require("./projectComponent.js");
var projectReference = require("./projectReference.js");
var innoScript = require("./innoScript.js");
var postBuildBatchFile = require("./postBuildBatchFile.js");
var internalBelongsTo = [];

// First argument (if passed in is the root folder)
var rootDir = ".";
if (process.argv.length > 2)
{
	rootDir = process.argv[2];
}

var internalComponentsPath = [];
var externalComponentsPath = [];
var internalComponentsJsonDir = path.join(rootDir, "..\\ComponentsJson");
var externalComponentsJsonDir = path.join(rootDir, "..\\ComponentsJson\\external");
var referencesJsonDir = path.join(rootDir, "..\\ReferencesJson");
var scriptsDir = path.join(rootDir, "..\\..\\Generated scripts");
var postBuildBatchFilesDir = path.join(rootDir, "..\\..\\Generated scripts\\postbuild");
var cruiseControlFilesDir = path.join(rootDir, "..\\..\\CruiseControl files");
var cruiseControlBootstrappersDir = path.join(cruiseControlFilesDir, "ProjectBootstrappers");

CreateDirectoryIfNotExists(scriptsDir);
CreateDirectoryIfNotExists(postBuildBatchFilesDir);
CreateDirectoryIfNotExists(cruiseControlFilesDir);
CreateDirectoryIfNotExists(cruiseControlBootstrappersDir);

function caseInsensitiveSort(a, b)
{
	return a.toLowerCase().localeCompare(b.toLowerCase());
}

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
		var ccProjects = [];
		ccProjects.push("Dependencies");
		ccProjects.push("Installs");
		var ccProjectsDependencies = [];
		ccProjectsDependencies.push("");
		ccProjectsDependencies.push("");

		for (var i = 0; i < solutionJsonDirs.length; i++) {	
			var newDeps = [];		
			console.log("Process solution " + solutionJsonDirs[i]);
			ReadSolutionJsonDir(path.join(referencesJsonDir, solutionJsonDirs[i]), newDeps);
			ccProjects.push(solutionJsonDirs[i]);
		
			var depsText = ""; 
			if ((solutionJsonDirs[i] == "AdminTool") || (solutionJsonDirs[i] == "legacyRFS") || (solutionJsonDirs[i] == "TitanRecorder") || (solutionJsonDirs[i] == "TitanVision"))
			{
				depsText = depsText + "InstallsOutput.txt,";
			}
			depsText = depsText + "DependenciesOutput.txt";
			
			// Remove duplicates and sort
			var sortedDeps = [];		
			//newDeps.sort();
			//Annoyingly the default sort treats upper and lower case differently
			newDeps.sort(caseInsensitiveSort);
	
			var previous = "";
			for (var z = 0; z < newDeps.length; z++) {
				if (newDeps[z] !== solutionJsonDirs[i])
				{
					if (previous != newDeps[z])
					{
						sortedDeps.push(newDeps[z]);
						previous = newDeps[z];
					}
				}
			}			
			
			if (sortedDeps.length > 0)
			{
				depsText = depsText + "," + sortedDeps[0] + "Output.txt";
				for (var k = 1; k < sortedDeps.length; k++) {
					depsText = depsText + "," + sortedDeps[k] + "Output.txt";
				}
			}
			ccProjectsDependencies.push(depsText);		
		}
		
		console.log('Waiting for the end ....,');
		setTimeout(function() {
		var depsText = "<project name=\"bootstrapperDependencies\">\r\n";
		depsText = depsText + "\t<!-- The following dependencies properties is read by some javascript in svn-macros.xml so don't include extra spaces when modifying -->\r\n";
		
		for (var j = 0; j < ccProjects.length; j++) {	
			depsText = depsText + "\t<property name=\"" + ccProjects[j] + "Dependencies\"";
			depsText = depsText + " value=\"" + ccProjectsDependencies[j] + "\"/>\r\n";
		}
		
		depsText = depsText + "</project>";
		var depsFile = path.join(cruiseControlBootstrappersDir, "BootstrapperDependencies.xml");
		fs.writeFile(depsFile, depsText);
		    console.log('THIS IS THE END');
		}, 3000);
	});	
});

function CreateDirectoryIfNotExists(dirToBeCreated)
{
	var createDir = false;
	try
	{
		var statDir = fs.lstatSync(dirToBeCreated);
		if (!statDir.isDirectory())
		{
			fs.mkdirSync(dirToBeCreated);		
		}
	}
	catch (e)
	{
		console.log("Directory doesn't exist: " + dirToBeCreated);
		createDir = true;
	}
	
	if (createDir)
	{
		try
		{
			fs.mkdirSync(dirToBeCreated);
			console.log("Directory created: " + dirToBeCreated);
		}
		catch (e)
		{
			console.log("Problem creating directory: " + dirToBeCreated);
		}
	}
}

function ProcessInternalComponent(file, obj)
{
	var project = obj.name;
	
	var internalComponent = new projectComponent(obj);
	if (!internalComponent.testProject)
	{
		var parent = file.replace(".json", "");
		internalBelongsTo[internalComponent.id] = parent;
		//console.log("This: " + internalComponent.id + " belongs to " + parent);
	}
	
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
			console.log("Process component " + file);
			var fileContents = fs.readFileSync(fullPath, 'UTF-8');
			var myJson = JSON.parse(fileContents);
				
			for (var i = 0; i < myJson.components.length; i++) {
			    ProcessComponent(file, myJson.components[i]);				
			}
		}
	}, this);
}

function ReadSolutionJsonDir(solutionDir, newDeps)
{
	if (fs.statSync(solutionDir).isDirectory())
	{
		var projectFiles = fs.readdirSync(solutionDir);	
		for (var i = 0; i < projectFiles.length; i++) {			
			ReadProjectJsonDir(path.join(solutionDir, projectFiles[i]), projectFiles[i], newDeps);			
		}	
	}
}

function ReadProjectJsonDir(projectFile, bottomDir, newDeps)
{	
	var component = bottomDir.replace(".json", "");
	
	var referenceFileContents = fs.readFileSync(projectFile, 'UTF-8');
	var myJson = JSON.parse(referenceFileContents);
	var reference = "";
	var references = [];		
	var externalReferences = [];
	var internalExtraReferences = [];
	
	if (myJson.references != undefined)
	{		
		for (var i = 0; i < myJson.references.length; i++) {
			reference = new projectReference(myJson.references[i]);
			if (internalComponentsPath[reference.id] !== undefined)
			{
				reference.components = internalComponentsPath[reference.id];
				references.push(reference);
			}
			else
			{
				// Check external refernces
				if (externalComponentsPath[reference.id] !== undefined)
				{
					reference.components = externalComponentsPath[reference.id];
					externalReferences.push(reference);
				}
			}
		}
	}
	
	if (myJson.nonVisualStudioReferences != undefined)
	{
		for (var i = 0; i < myJson.nonVisualStudioReferences.length; i++) {
			reference = new projectReference(myJson.nonVisualStudioReferences[i]);
			if (internalComponentsPath[reference.id] !== undefined)
			{
				reference.components = internalComponentsPath[reference.id];
				internalExtraReferences.push(reference);
			}
			else
			{
				// Check external refernces
				if (externalComponentsPath[reference.id] !== undefined)
				{
					reference.components = externalComponentsPath[reference.id];
					externalReferences.push(reference);
				}
			}
		}
	}
		
	var components = internalComponentsPath[component];
	var componentInnoScript = new innoScript(scriptsDir, component);
	componentInnoScript.CreateIssDependencyScript(components, references, internalExtraReferences, externalReferences);
	
	var componentBatchFile = new postBuildBatchFile(postBuildBatchFilesDir, component);
	componentBatchFile.CreatePostBuildBatchFile(components, references, internalExtraReferences);
	
	if (internalBelongsTo[component] != undefined)
	{
		var referencesText = "";
		for (var i = 0; i < references.length; i++) {
			referencesText = referencesText + internalBelongsTo[references[i].id] + ",";	
			if (internalBelongsTo[references[i].id] == undefined)
			{
				console.log("Can't find " + references[i].id + " - " + projectFile);
			}	
			newDeps.push(internalBelongsTo[references[i].id]);
		}
		
		console.log(component + " needs " + referencesText);
	}
}