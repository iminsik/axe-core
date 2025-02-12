/*global dom, color */
/* jshint maxstatements: 31, maxcomplexity: 14 */
//TODO dsturley: too complex, needs refactor!!

/**
 * Returns the non-alpha-blended background color of a node, null if it's an image
 * @param {Element} node
 * @return {Color}
 */
function getBackgroundForSingleNode(node) {
	var bgColor,
		nodeStyle = window.getComputedStyle(node);

	if (nodeStyle.getPropertyValue('background-image') !== 'none') {
		return null;
	}

	var bgColorString = nodeStyle.getPropertyValue('background-color');
	//Firefox exposes unspecified background as 'transparent' rather than rgba(0,0,0,0)
	if (bgColorString === 'transparent') {
		bgColor = new color.Color(0, 0, 0, 0);
	} else {
		bgColor = new color.Color();
		bgColor.parseRgbString(bgColorString);
	}
	var opacity = nodeStyle.getPropertyValue('opacity');
	bgColor.alpha = bgColor.alpha * opacity;

	return bgColor;
}

/**
 * Determines whether an element has a fully opaque background, whether solid color or an image
 * @param {Element} node
 * @return {Boolean} false if the background is transparent, true otherwise
 */
dom.isOpaque = function(node) {
	var bgColor = getBackgroundForSingleNode(node);
	if (bgColor === null || bgColor.alpha === 1) {
		return true;
	}
	return false;
};

/**
 * Returns the elements that are visually "above" this one in z-index order where
 * supported at the position given inside the top-left corner of the provided
 * rectangle. Where not supported (IE < 10), returns the DOM parents.
 * @param {Element} node
 * @param {DOMRect} rect rectangle containing dimensions to consider
 * @return {Array} array of elements
 */
var getVisualParents = function(node, rect) {
	var visualParents,
		thisIndex,
		parents = [],
		fallbackToVisual = false,
		currentNode = node,
		nodeStyle = window.getComputedStyle(currentNode),
		posVal, topVal, bottomVal, leftVal, rightVal;

	while (currentNode !== null && (!dom.isOpaque(currentNode) || parseInt(nodeStyle.getPropertyValue('height'), 10) === 0)) {
		// If the element is positioned, we can't rely on DOM order to find visual parents
		posVal = nodeStyle.getPropertyValue('position');
		topVal = nodeStyle.getPropertyValue('top');
		bottomVal = nodeStyle.getPropertyValue('bottom');
		leftVal = nodeStyle.getPropertyValue('left');
		rightVal = nodeStyle.getPropertyValue('right');
		if ((posVal !== 'static' && posVal !== 'relative') ||
			(posVal === 'relative' &&
				(leftVal !== 'auto' ||
					rightVal !== 'auto' ||
					topVal !== 'auto' ||
					bottomVal !== 'auto'))) {
			fallbackToVisual = true;
		}
		currentNode = currentNode.parentElement;
		if (currentNode !== null) {
			nodeStyle = window.getComputedStyle(currentNode);
			if (parseInt(nodeStyle.getPropertyValue('height'), 10) !== 0) {
				parents.push(currentNode);
			}
		}
	}

	if (fallbackToVisual && dom.supportsElementsFromPoint(document)) {
		visualParents = dom.elementsFromPoint(document,
			Math.ceil(rect.left + 1),
			Math.ceil(rect.top + 1));
		thisIndex = visualParents.indexOf(node);

		// if the element is not present; then something is obscuring it thus making calculation impossible
		if (thisIndex === -1) {
			return null;
		}

		if (visualParents && (thisIndex < visualParents.length - 1)) {
			parents = visualParents.slice(thisIndex + 1);
		}
	}

	return parents;
};


/**
 * Returns the flattened background color of an element, or null if it can't be determined because
 * there is no opaque ancestor element visually containing it, or because background images are used.
 * @param {Element} node
 * @param {Array} bgNodes array to which all encountered nodes should be appended
 * @return {Color}
 */
//TODO dsturley; why is this passing `bgNodes`?
color.getBackgroundColor = function(node, bgNodes) {
	var parent, parentColor;

	var bgColor = getBackgroundForSingleNode(node);
	if (bgNodes && (bgColor === null || bgColor.alpha !== 0)) {
		bgNodes.push(node);
	}
	if (bgColor === null || bgColor.alpha === 1) {
		return bgColor;
	}

	var rect = node.getBoundingClientRect(),
		currentNode = node,
		colorStack = [{
			color: bgColor,
			node: node
		}],
		parents = getVisualParents(currentNode, rect);
	if (!parents) {
		return null;
	}

	while (bgColor.alpha !== 1) {
		parent = parents.shift();

		if (!parent && currentNode.tagName !== 'HTML') {
			return null;
		}

		//Assume white if top level is not specified
		if (!parent && currentNode.tagName === 'HTML') {
			parentColor = new color.Color(255, 255, 255, 1);
		} else {

			if (!dom.visuallyContains(node, parent)) {
				return null;
			}

			parentColor = getBackgroundForSingleNode(parent);
			if (bgNodes && (parentColor === null || parentColor.alpha !== 0)) {
				bgNodes.push(parent);
			}
			if (parentColor === null) {
				return null;
			}
		}
		currentNode = parent;
		bgColor = parentColor;
		colorStack.push({
			color: bgColor,
			node: currentNode
		});
	}

	var currColorNode = colorStack.pop();
	var flattenedColor = currColorNode.color;

	while ((currColorNode = colorStack.pop()) !== undefined) {
		flattenedColor = color.flattenColors(currColorNode.color, flattenedColor);
	}
	return flattenedColor;
};
