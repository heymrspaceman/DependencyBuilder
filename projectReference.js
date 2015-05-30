/// <reference path="typings/node/node.d.ts"/>

function projectReference(element, obj) {
	
    if (obj != undefined)
    {
		console.log("AAA : " + obj.name);
		this.id = obj.name;
		this.referenced = (obj.referenced == undefined);
		return;
    }
	var elementSplit = element.split(":");
	this.id = elementSplit[0].trim();
	
	if (elementSplit.length > 1)
	{
		this.referenced = false;
	}
	else
	{		
		this.referenced = true;
	}
}

projectReference.prototype.copy = function()
{
	var newReference = new projectReference("");
	newReference.id = this.id;
	
	return newReference;
}

// export the class
module.exports = projectReference;
  