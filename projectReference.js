/// <reference path="typings/node/node.d.ts"/>

function projectReference(obj) {
	
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

// export the class
module.exports = projectReference;
  