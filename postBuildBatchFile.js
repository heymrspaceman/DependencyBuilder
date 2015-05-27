/// <reference path="typings/node/node.d.ts"/>

var fs = require('fs');
var path = require('path');

function postBuildBatchFile() {
}

postBuildBatchFile.prototype.CreatePostBuildBatchFile = function
(component, dependencies, internalExtraDependencies, internalComponentsPath, externalComponentsPath, postBuildBatchFilesDir)
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

// export the class
module.exports = postBuildBatchFile;