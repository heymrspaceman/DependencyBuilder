/// <reference path="typings/node/node.d.ts"/>

function projectReference(obj) {
	
    if (obj != undefined)
    {
		console.log("AAA : " + obj.name);
		this.id = obj.name;
		this.referenced = (obj.referenced == undefined);
		return;
    }
}

projectReference.prototype.copy = function()
{
	var newReference = new projectReference(undefined);
	newReference.id = this.id;
	newReference.referenced = this.referenced;
	
	return newReference;
}

// export the class
module.exports = projectReference;
  