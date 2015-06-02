/// <reference path="typings/node/node.d.ts"/>

var path = require('path');

function projectComponent(obj) {
  
  this.destinationFolder = "";
  this.register = false;
  this.sourceOnly = false;
  this.noConfig = false;
  this.original = false;
  this.postBuild = true;
  
  if (obj != undefined)
  {
	  this.id = obj.name;
	  this.original = (obj.original != undefined);
	  this.noConfig = (obj.noConfig != undefined);
	  this.register = (obj.register != undefined);
	  this.postBuild = (obj.postBuild == undefined);
	  
	  if (obj.artifact != undefined)
	  {
		  var source = obj.artifact;
		  if (source.indexOf("\\\\") > 0)
		  {
			  source = source.replace("\\\\",":\\");
			  this.fullPath = true;
		  }
		  else
		  {				  	
			  this.fullPath = false;
		  }		  
		  
		  this.source = source;
		  this.sourceOnly = (obj.sourceOnly != undefined);
		  if (obj.alternativeSource != undefined)
		  {
			  this.alternativeSource = obj.alternativeSource.replace("\\\\",":\\");
		  }
		  
		  if (obj.destinationFolder != undefined)
		  {
			  this.destinationFolder = obj.destinationFolder;
		  }
			  		  
		  // Extract the filename from the full artifact path, note the file may not exist at this point in time
		  // so we cannot use fs.stat
		  var sourceSplit = this.source.split("\\");	
		  this.sourceFilenameOnly = sourceSplit[sourceSplit.length - 1];
	  }
	  
	  return;
  }  
}

projectComponent.prototype.copy = function()
{
	var newComponent = new projectComponent(undefined);
	newComponent.source = this.source;
	newComponent.sourceFilenameOnly = this.sourceFilenameOnly;
	newComponent.alternativeSource = this.alternativeSource;
	newComponent.destinationFolder = this.destinationFolder;
	newComponent.register = this.register;
	newComponent.sourceOnly = this.sourceOnly;
	newComponent.noConfig = this.noConfig;
	newComponent.original = this.original;
	
	return newComponent;
}

// TODO refactor this with GenerateArtifactBatchCopy
projectComponent.prototype.GenerateArtifactInclude = function()
{
	var include = "";
	var artifactFullPath = this.source;

	if (artifactFullPath !== undefined)
	{
		// artifactFullPath is from the root folder of the project, however this is run from within the Setups folder
		// so add a ..\
		artifactFullPath = "..\\" + artifactFullPath;			
		if (this.sourceOnly)
		{
			var destinationFolder = "";
			if (this.destinationFolder.length > 0)
			{
				destinationFolder = "\\" + this.destinationFolder;
			}
			include = include + "Source: \"" + artifactFullPath + "\"; DestDir: \"{app}\\{#DestSubDir}" + destinationFolder + "\"; Flags: ignoreversion\r\n";			
		}
		else
		{
			include = include + "#ifexist \"" + artifactFullPath + "\"\r\n";
			include = include + "\tSource: \"" + artifactFullPath + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
			include = include + "#else\r\n";
			include = include + "\tSource: \"..\\dependencies_svn\\dlls\\internal\\" + this.destinationFolder + this.sourceFilenameOnly + "\"; DestDir: \"{app}\\{#DestSubDir}\"; Flags: ignoreversion\r\n";
			include = include + "#endif\r\n";
		}
	}
				
	if (!this.noConfig)
	{
		if ((path.extname(artifactFullPath)) == ".exe")
		{
			var configComponent = this.copy();
			configComponent.source = configComponent.source + ".config";
			configComponent.sourceFilenameOnly = configComponent.sourceFilenameOnly + ".config";
			include = include + "\r\n" + configComponent.GenerateArtifactInclude();
		}
	}
	
	return include;
}

// At the moment this only handles one file per external
projectComponent.prototype.GenerateExternalIssCopy = function()
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

// export the class
module.exports = projectComponent;