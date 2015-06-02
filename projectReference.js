/// <reference path="typings/node/node.d.ts"/>

function projectReference(obj) {
	
	this.components = undefined;
    if (obj != undefined)
    {
		this.id = obj.name;
		return;
    }
}

projectReference.prototype.copy = function()
{
	var newReference = new projectReference(undefined);
	newReference.id = this.id;
	
	return newReference;
}


projectReference.prototype.requiresPostBuild = function()
{		
	var requires = false;
	if (this.components != undefined)
	{
		this.components.forEach(function(comp) {
			requires = requires || comp.postBuild;
		}, this);
	}
	
	return requires;
}

// export the class
module.exports = projectReference;
  