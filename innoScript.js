/// <reference path="typings/node/node.d.ts"/>

var fs = require('fs');
var path = require('path');

function innoScript(dir, component) {
	this.filename = component + "_dependencies.iss";
	this.filename = path.join(dir, this.filename);
}

innoScript.prototype.CreateIssDependencyScript = function
(components, internalDepencencies, internalExtraDependencies, externalDependencies)
{
	var fileContents = "[Files]\r\n;Internal\r\n";
	var originalScript = false;
	
	// Build artifacts		
	if (components !== undefined)
	{
		components.forEach(function(fetchedComponent) {
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
				var scriptFolder = "";
				if (extraRef.components !== undefined)
				{
					extraRef.components.forEach(function(internalComponent) {
						if (internalComponent.original)
						{
							scriptFolder = "original\\";
						}
					}, this);
				}
				
				fileContents = fileContents + "#include \"" + scriptFolder + extraRef.id + "_dependencies.iss\"\r\n";			
			}, this);
		}
			
		if (externalDependencies.length > 0) {
			fileContents = fileContents + "\r\n;External";
			externalDependencies.forEach(function(ref) {
				if (ref.components !== undefined)
				{
					fileContents = fileContents + "\r\n;" + ref.id + "\r\n";
					ref.components.forEach(function(externalComponent) {
						fileContents = fileContents + externalComponent.GenerateExternalIssCopy();
					}, this);
				}
			}, this);
		}
		
		fs.writeFile(this.filename, fileContents);
	}
}

// export the class
module.exports = innoScript;
  