/// <reference path="typings/node/node.d.ts"/>

var path = require('path');

function projectComponent(splitData) {
  
  this.destinationFolder = "";
  this.register = false;
  this.sourceOnly = false;
  this.noConfig = false;
  this.original = false;
  
  if (splitData.length > 0)
  {
	  this.id = splitData[0];
	  if (splitData.length > 1)
	  { 
		  var source = splitData[1];
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
					
					  if (splitData.length > 5)
					  {
						  if (splitData[5] == "sourceOnly")
						  {
							  this.sourceOnly = true;
						  }
							  
						  if (splitData.length > 6)
						  {
							  if (splitData[6] == "noConfig")
							  {
								  this.noConfig = true;
							  }
							  
							  if (splitData.length > 7)
							  {
								  if (splitData[7] == "original")
								  {
									  this.original = true;
								  }
							  }
						  }
					  }	
				  }
			  }
		  }
	  }
  }  
}

projectComponent.prototype.copy = function()
{
	var newComponent = new projectComponent("");
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

// TODO refactor this with GenerateArtifactInclude
projectComponent.prototype.GenerateArtifactBatchCopy = function()
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
				
	if (this.noConfig)
	{
		console.log("noConfig");
	}
	else
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