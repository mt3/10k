/**
 * scanner.js - responsible for extracting potentially interesting content from the page.
 */
(function(tenk){

/**
 * scans the page for index worthy content
 */
function scanner(window,document,undefined) {
	
	// thanks ppk! http://www.quirksmode.org/dom/getstyles.html
	var view = document.defaultView;
	function getStyle(el,styleProp) {
		var style;
		if (el.currentStyle) {
			style = el.currentStyle[styleProp];
		} else if (window.getComputedStyle) {
			style = view.getComputedStyle(el,null).getPropertyValue(styleProp);
		}
		return style;
	}
	
	/**
	 * determine whether a given element is visible
	 */
	function visible(elem) {
		return getStyle(elem, 'display') !== 'none' && getStyle(elem, 'visiblity') !== 'hidden';
	}
	
	// iterator vars
	var
		i,
		j,
		l,
		m,
		n;
	
	// get selection - best clue as to the important content on the page
	var selection = document.getSelection() || '';
	
	// prioritize headings over other content
	var
		tags = 'h1,h2,h3,h4,h5,h6,pre,code'.split(','),
		priority = [],
		elems,
		el;
	for (i=0, l=tags.length; i<l; i++) {
		elems = document.getElementsByTagName(tags[i]);
		for (j=0, m=elems.length; j<m; j++) {
			el = elems[j];
			if (visible(el)) {
				priority.push(el.textContent);
			}
		}
	}
	
	// initialize vars for content scan
	var
		
		// full text content
		content = [],
		
		// queue of elements left to scan, current element, and its children nodes
		queue = [document.body],
		elem,
		children,
		
		// current child being evaluated and its nodeType
		child,
		type,
		
		// test for interesting strings
		interesting = /[a-z][a-z][a-z]/i,
		
		// tags to ignore
		ignore = /button|link|noscript|script|style/i;
	
	// scan document for content
	while (elem = queue.shift()) {
		children = elem.childNodes;
		for (i=0, l=children.length; i<l; i++) {
			child = children[i];
			type = child.nodeType;
			if (
				type === 1 && 
				!(ignore).test(child.tagName) &&
				visible(child)
			) {
				queue[queue.length] = child;
			} else if (type === 3) {
				text = child.nodeValue;
				if ((interesting).test(text)) {
					content[content.length] = text;
				}
			}
		}
	}
	
	// send extracted data off for indexing
	window['10kse'].iframe.contentWindow.postMessage(JSON.stringify({
		url: document.location.href,
		selection: selection,
		title: document.title,
		priority: priority.join(" "),
		content: content.join(" ")
	}), "*");
	
}

// export
tenk.scanner = scanner;

})(window['10kse']);

