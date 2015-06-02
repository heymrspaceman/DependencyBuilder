/// <reference path="typings/node/node.d.ts"/>

var fs = require('fs');
var path = require('path');

function postBuildBatchFile(dir, component) {
	this.filename = "CopyDependenciesInternal" + component +  ".bat";
	this.filename = path.join(dir, this.filename);
}

postBuildBatchFile.prototype.CreatePostBuildBatchFile = function
(components, dependencies, internalExtraDependencies)
{	
	var originalBatchFile = false;
	var createPostBuild = false;
	
	var fileContents = "@echo off\r\n";
	fileContents = fileContents + "REM 2 parameters are passed in wrapped in quotes, but this causes problems when using them but putting them in variables solves it\r\n";
	fileContents = fileContents + "set param1=%~1\r\n";
	fileContents = fileContents + "set param2=%~2\r\n";
	fileContents = fileContents + "set param3=%~3\r\n";
	fileContents = fileContents + "REM echo \"*** Parameter 1 removed quotes: (%param1%)\"\r\n";
	fileContents = fileContents + "REM echo \"*** Parameter 2 removed quotes: (%param2%)\"\r\n";
	fileContents = fileContents + "\r\n";
	
	if (components !== undefined)
	{
		components.forEach(function(fetchedComponent) {
			originalBatchFile = originalBatchFile || fetchedComponent.original;
			createPostBuild = createPostBuild || fetchedComponent.postBuild;
			fileContents = fileContents + this.GenerateArtifactBatchCopy(fetchedComponent);
		}, this);
	}
			
	if ((!originalBatchFile) && (createPostBuild))
	{
		dependencies.forEach(function(ref) {
			fileContents = fileContents + this.BuildBatchFileCall(ref);
		}, this);
		
		if (internalExtraDependencies.length > 0)
		{
			fileContents = fileContents + "\r\nREM Internal but not referenced in Visual Studio\r\n";
			internalExtraDependencies.forEach(function(ref) {
				fileContents = fileContents + this.BuildBatchFileCall(ref);
			}, this);
		}
			
		fs.writeFile(this.filename, fileContents);
	}
}

postBuildBatchFile.prototype.BuildBatchFileCall = function(reference)
{
	var text = "Call \"%param1%\\dependencies_svn\\scripts\\postbuild\\CopyDependenciesInternal";
	text = text + reference.id + ".bat\" \"%param1%\" \"%param2%\" \"%param3%\"\r\n";
	text = text + "if errorlevel 1 echo \"Error in %0\" exit\r\n";
	
	return text;
}


// TODO refactor this with GenerateArtifactInclude
postBuildBatchFile.prototype.GenerateArtifactBatchCopy = function(reference)
{
	var copy = "";
	var batchSource = reference.source;

	if (batchSource !== undefined)
	{	
		// Replace any exlpicit Release directory with param3
		batchSource = batchSource.replace("Release", "%param3%");
		
		copy = copy + "if not exist \"%param1%\\" + batchSource + "\" (\r\n";
		copy = copy + "\tcopy /Y \"%param1%\\dependencies_svn\\dlls\\internal\\" + reference.destinationFolder + reference.sourceFilenameOnly + "\" \"%param2%\"\r\n";
		copy = copy + "\tif errorlevel 1 echo \"Error in %0\" exit\r\n";
		copy = copy + ")\r\n";
		copy = copy + "\r\n";		
	}
	
	return copy;
}

// export the class
module.exports = postBuildBatchFile;