/**
 * intro.js
 */
(function(window){


var
	
	// storage api
	storage = window.localStorage,
	
	// serialization api
	stringify = window.JSON.stringify,
	parse = window.JSON.parse,
	
	// establish 10k search engine namespace
	tenk = window['10kse'] = {},
	
	// so-called "stop" words (uninteresting to a search application)
	stopwords = "able|about|across|after|all|almost|also|among|and|any|are|because|been|but|can|cannot|could|dear|did|does|either|else|ever|every|for|from|get|got|had|has|have|her|hers|him|his|how|however|into|its|just|least|let|like|likely|may|might|most|must|neither|nor|not|off|often|only|other|our|own|rather|said|say|says|she|should|since|some|than|that|the|their|them|then|there|these|they|this|tis|too|twas|wants|was|were|what|when|where|which|while|who|whom|why|will|with|would|yet|you|your".split("|"),
	stop = {};

// build stop hash
for (var i=0, l=stopwords.length; i<l; i++) {
	stop[stopwords[i]] = true;
}

/**
 * get an item from localStorage.
 */
function get(key) {
	var value = storage.getItem(key);
	return value ? parse(value) : value;
}

/**
 * put an item into localStorage
 */
function set(key, value) {
	return storage.setItem(key, stringify(value));
}

/**
 * numeric difference - used in sorting arrays numerically.
 */
function asc(a,b){
	return a - b;
}

// exports
tenk.asc = asc;
tenk.get = get;
tenk.set = set;
tenk.stop = stop;

})(window);
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
	
	/**
	 * utility function for getting an element's text content.
	 */
	function gettext(elem) {
		return elem.innerText || elem.textContent;
	}
	
	// concepts borrowed from readability, and adapted to search content scanning
	// http://code.google.com/p/arc90labs-readability/
	var
		
		// list of candidate container elements, and count
		candidates = [],
		count = 0,
		
		// short-hand for custom DOM property
		s = '10score',
		
		// regular expression matching contiguous whitespace characters
		whitespace = /\s+/g,
		
		// iterator vars
		i,
		l,
		j,
		m,
		n;
	
	/**
	 * interrogate an element and assign it a score based on its content.
	 */
	function interrogate(elem) {
		
		var
			parent = elem.parentNode,
			grandparent = parent.parentNode,
			text = gettext(elem).replace(whitespace, ' '),
			len = text.length,
			score = 1,
			points;
		
		if (len > 25) {
			
			if (parent[s] === undefined) {
				parent[s] = 0;
				candidates[count++] = parent;
			}
			
			if (grandparent[s] === undefined) {
				grandparent[s] = 0;
				candidates[count++] = parent;
			}
			
			/* Add points for any commas within this paragraph */
			score += text.split(',').length;
			
			/* For every 100 characters in this paragraph, add another point. Up to 3 points. */
			points = (len * 0.01) << 0;
			score += (points < 4 ? points : 3);
			
			/* Add the score to the parent. The grandparent gets half. */
			parent[s] += score;
			grandparent[s] += score * 0.5;
			
		}
	}
	
	// interrogate all paragraphs
	var ps = document.getElementsByTagName('p');
	for (i=0, l=ps.length; i<l; i++) {
		interrogate(ps[i]);
	}
	
	// interrogate interesting divs
	var
		
		// grab divs in document
		divs = document.getElementsByTagName('div'),
		div,
		
		// regular expression to identify interesting divs
		interesting = /<(a|blockquote|dl|div|img|ol|p|pre|table|ul|br)/i;
		
	for (i=0, l=divs.length; i<l; i++) {
		div = divs[i];
		if ((interesting).test(div.innerHTML)) {
			interrogate(div);
		}
	}
	
	// find the best element among the candidates
	var
		best = null,
		elem,
		links,
		link,
		linklen;
	for (i=0; i<count; i++) {
		elem = candidates[i];
		links = elem.getElementsByTagName('a');
		linklen = 0;
		for (j=0, m=links.length; j<m; j++) {
			link = links[j];
			linklen += gettext(link).length;
		}
		elem[s] = score = elem[s] * (1 - linklen / gettext(elem).length);
		if (!best || score > best[s]) {
			best = elem;
		}
	}
	
	// if none could be found, fall back to the document body
	best = best || document.body;
	
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
		queue = [best],
		children,
		
		// current child being evaluated and its nodeType
		child,
		type,
		
		// test for interesting strings
		wordy = /[a-z][a-z][a-z]/i,
		
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
				if ((wordy).test(text)) {
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

/**
 * indexer.js - responsible for extracting index worthy content from scanned content.
 */
(function(tenk,window){

var
	
	// local refs to local storage api
	get = tenk.get,
	set = tenk.set,
	
	// anything that doesn't belong to a 'word'
	nonword = /[^0-9a-z_]+/i,
	
	// so-called "stop" words (uninteresting to search)
	stop = tenk.stop;

/**
 * extract meaningful words and their positions from input text (create an inverted index).
 * @param {string} text Input text from which to extract words.
 * @return {object} Hash connecting words to there position lists
 */
function extract(text) {
	
	var
		
		// iteration variables
		i,
		l,
		
		// words in a text input
		words,
		word,
		
		// position within all text
		pos = 0,
		
		// lower cased word
		lc,
		
		// output hash mapping words to positions
		index = {},
		
		// array of positions for a word in the hash
		entry;
	
	words = text.split(nonword);
	
	for (i=0, l=words.length; i<l; i++) {
		
		pos++;
		word = words[i];
		lc = word.toLowerCase();
		
		if (word.length > 2 && !stop[lc]) {
			
			
			entry = index[lc];
			if (!entry) {
				entry = index[lc] = [];
			}
			
			entry[entry.length] = pos;
			
		}
	}
	
	return index;
}

/**
 * update store's records for a given document
 * @param {int} id ID of the document being updated.
 * @param {string} type Type of text being considered (selection, priority, or full content).
 * @param {string} text Text to be indexed.
 */
function update(id, type, text) {
	
	// short-circuit of nothing of value has been sent
	if (!text || !(/[a-z]/i).test(text)) {
		return;
	}
	
	var
		
		// extract a word/tuple index from the text
		index = extract(text),
		
		// current word
		word,
		
		// record for word in store
		record,
		
		// entry for current document within record
		entry;
	
	for (word in index) {
		
		// get entry for word from store
		record = get("W-" + word) || {};
		
		// ensure that this document is represented
		entry = record[id];
		if (!entry) {
			entry = record[id] = {};
		}
		
		// set (overwrite) positions for this type
		entry[type] = index[word];
		
		// set record for word in store
		set("W-" + word, record);
		
	}
	
}

/**
 * index interesting page content
 */
function indexer(data) {
	
	var
		
		// id and full text content of document
		id,
		text,
		
		// determine whether this url has been seen before
		doc = get("URL-" + data.url);
	
	// doc already exists
	if (doc) {
		
		id = doc.id;
		
		// if content is new, insert into store
		if (data.content !== doc.text || data.title !== doc.title) {
			set("URL-" + data.url, {
				id: id,
				text: data.content,
				title: data.title
			});
		}
		
	// doc never seen before
	} else {
		
		// look up current document count
		id = get("COUNT") || 0;
		
		// assign ID to doc
		set("ID-" + id, data.url);
		
		// set current document count
		set("COUNT", id + 1);
		
		// insert into store
		set("URL-" + data.url, {
			id: id,
			text: data.content,
			title: data.title
		});
		
	}
	
	// update indexes
	update(id, "s", data.selection);
	update(id, "t", data.title);
	update(id, "p", data.priority);
	update(id, "c", data.content);
	
}

// export
tenk.extract = extract;
tenk.indexer = indexer;

})(window['10kse'],window);

/**
 * bookmarklet.js - linchpin holding scanner and indexer behavior together.
 */
(function(window,document,$,tenk){

var
	
	// storage api
	get = tenk.get,
	set = tenk.set,
	
	// serialization api
	stringify = JSON.stringify;

/**
 * implementation of chain-loading bookmarklet
 */
function bookmarklet(window,document,origin) {
	
	// setup the 10kse namespace
	// NOTE: This does not duplicate the code in intro.js since 
	//       the bookmarklet will be running in a different page.
	var tenk = window['10kse'];
	if (!tenk) {
		tenk = window['10kse'] = {};
	}
	
	// if script was previously retrieved, simple rexecute it
	if (tenk.scanner) {
		return tenk.scanner();
	}
	
	// listen for script posted from origin and eval it
	window.addEventListener("message", function (event) {
		if (origin.substr(0, event.origin.length)===event.origin) {
			tenk.scanner = new Function(event.data);
			tenk.scanner();
		}
	}, false);
	
	// open iframe to origin and style it
	var
		iframe = tenk.iframe = document.createElement('iframe'),
		style = iframe.style;
	iframe.setAttribute('src', origin);
	style.width = style.height = "1px";
	style.top = style.left = "-2px";
	style.border = "none";
	style.position = "absolute";
	
	// prepare listeners for iframe state changes, and
	// when iframe is ready, use postMessage() to ask for script
	var done = false;
	iframe.onload = iframe.onreadystatechange = function() {
		if (!done && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete")) {
			done = true;
			iframe.onload = iframe.onreadystatechange = null;
			iframe.contentWindow.postMessage("script", origin);
		}
	};
	
	// append iframe
	document.body.appendChild(iframe);
}

// generate random token to prevent postMessage() spam, and
// create composit origin url for anchor tag
var
	origin = document.location.href,
	key = get('key');
if (!key) {
	key = Math.random();
	set('key',key);
}
origin = JSON.stringify(origin.replace(/#.*|$/, '#' + key));

// attach bookmarklet to "add" link
$('#add')
	.attr('href', ('javascript:(' + bookmarklet + ')(window,document,' + origin + ')').replace(/\s+/g, ' '))
	.click(function(e){
		e.preventDefault();
		alert(
			"1. Drag this link to your bookmarks,\n" +
			"2. Navigate to another page,\n" +
			"3. Click the bookmarklet to add that page to your search engine."
		);
	});

/**
 * listen for incoming messages when in iframe mode
 */
if (window !== window.top && document.location.hash === '#' + key) {
	window.addEventListener("message", function(event) {
		
		// serve script to anyone who requests it
		if (event.data === "script") {
			event.source.postMessage('(' + tenk.scanner + ')(window,document)', "*");
			return;
		}
		
		// process index submission
		tenk.indexer(JSON.parse(event.data));
		
	}, false);
}

})(window,document,jQuery,window['10kse']);

/**
 * showall.js - show all pages entered so far.
 */
(function(tenk,$,window){

// short-circuit if this page is in an iframe
if (window !== window.top) {
	return;
}

var
	
	// storage api
	get = tenk.get,
	
	// document characteristics
	id = get("COUNT") || 0,
	url,
	doc;

// show pages added so far, in reverse chronological order
if (id > 0) {
	
	var $list = $('<ul></ul>')
		.appendTo(
			$('.entries')
				.find('div')
					.empty()
		);
	
	while (id > 0) {
		id--;
		url = get("ID-" + id);
		doc = get("URL-" + url);
		$('<li><a></a></li>')
			.find('a')
				.attr('href', url)
				.attr('title', doc.title)
				.text(doc.title)
			.end()
			.appendTo($list);
	}
}

})(window['10kse'],jQuery,window);

/**
 * ranking.js
 */
(function(tenk,undefined){

var
	
	// storage api
	get = tenk.get;

/**
 * normalize a set of scores.
 * @param {object} scores Hash containing id/score pairs.
 * @param {int} multiplier Number to multiply each score by prior to normalization (accounts for direction, -1 for lower-is-better).
 * @param {float} fallback Fall back value to use if all the scores are identical (defaults to 0.5).
 * @return {object} scores Hash containing id/normalized score pairs (highest is best, 0-1 range).
 */
function normalize(scores, multiplier, fallback) {
	
	if (multiplier === undefined) {
		multiplier = 1;
	}
	
	if (fallback === undefined) {
		fallback = 0.5;
	}
	
	var
		normalized = {},
		id,
		high,
		low,
		spread,
		s;
	
	for (id in scores) {
		s = normalized[id] = scores[id] * multiplier;
		if (high === undefined || s > high) {
			high = s;
		}
		if (low === undefined || s < low) {
			low = s;
		}
	}
	
	if (high === low) {
		for (id in normalized) {
			normalized[id] = fallback;
		}
		return normalized;
	}
	
	spread = 1 / (high - low);
	
	for (id in normalized) {
		normalized[id] = (normalized[id] - low) * spread;
	}
	
	return normalized;
}

/**
 * count how many times the terms appear in the document
 * @param {object} ids Hash in which keys are document ids (values unimportant).
 * @param {array} terms List of search terms provided.
 * @param {string} type The type of content to count ('s'election, 't'itle, 'p'riority, or 'c'ontent).
 * @param {object} recordcache Hash mapping words to their localStorage values.
 * @return {object} Hash of id/score pairs.
 */
function wordcount(ids, terms, type, recordcache) {
	
	if (!recordcache) {
		recordcache = {};
	}
	
	var
		scores = {},
		term,
		record,
		id,
		entry,
		positions;
	
	for (var i=0, l=terms.length; i<l; i++) {
		
		term = terms[i];
		if (term.length > 2 && !stop[term]) {
			
			record = recordcache[term] || (recordcache[term] = get("W-" + term));
			
			for (id in ids) {
				
				entry = record[id];
				if (entry) {
					
					positions = entry[type];
					if (positions) {
						if (scores[id] === undefined) {
							scores[id] = 0;
						}
						scores[id] += (+positions.length);
					}
					
				}
				
			}
			
		}
		
	}
	
	return scores;
	
}

// exports
tenk.wordcount = wordcount;
tenk.normalize = normalize;

})(window['10kse']);

/**
 * highlight.js
 */
(function(tenk,$,undefined){

var
	
	// scratch pad for html special character conversion
	$scratch = $('<div></div>');

/**
 * highlight terms in the provided text.
 * @param {string} text The text to highlight.
 * @param {array} terms An array of terms to highlight.
 * @param {boolean} truncate Whether to truncate the output (defaults to true).
 */
function highlight(text, terms, truncate) {
	
	// default behavior is to truncate
	if (truncate === undefined) {
		truncate = true;
	}
	
	// convert html special characters to entities
	text = $scratch.text(text).html();
	
	var
		
		// lowercase version of text for performing indexOf lookups
		lc = text.toLowerCase(),
		
		// memory of whether we've seen this term before
		seen = {},
		
		// mapping of indexes to terms
		index = {},
		
		// flat list of positions for sorting
		flat = [],
		
		// number of term matches to find before terminating the loop
		limit = 3,
		
		// iteration vars
		i,
		l,
		
		// term being evaluated;
		term,
		len,
		
		// count of how many of this term have been found
		count,
		
		// current position
		pos;
	
	// find first few positions of terms
	for (i=0, l=terms.length; i<l; i++) {
		
		term = terms[i].toLowerCase();
		len = term.length;
		
		if (len > 2 && !seen[term]) {
			
			seen[term] = true;
			
			count = 0;
			pos = 0;
			
			while (count < limit) {
				
				// find the next match
				pos = lc.indexOf(term, pos);
				
				// abort if there are none
				if (pos === -1) {
					break;
				}
				
				// grab the characters preceeding and succeeding the match
				var
					before = text.charAt(pos - 1).toLowerCase(),
					after = text.charAt(pos + len).toLowerCase();
				
				// check that they're not 'word' characters
				if (
					(before < 'a' || before > 'z') &&
					(after < 'a' || after > 'z')
				) {
					
					count++;
					flat[flat.length] = pos;
					index[pos] = term;
					
				}
				
				// increment pos to skip past the last match
				pos += len;
				
			}
			
		}
	}
	
	// sort the matches
	flat.sort(tenk.asc);
	
	var
		
		// buffer to hold segments and cumulative size of segments so far
		buf = [],
		size = 0,
		
		// maximum allowable blurb size
		maxsize = 200,
		
		// maximum allowable segment size
		maxseg = 50,
		doubleseg = maxseg * 2;
	
	// build out a buffer
	len = flat.length;
	pos = 0;
	i = 0;
	while (size < maxsize && i <= len) {
		
		// grab the text segment
		var
			loc = flat[i],
			segment = ( i < len ? text.substr(pos, loc - pos) : text.substr(pos) ),
			slen = segment.length;
		
		// truncate the segment if it's too long
		if (truncate) {
			
			// last segment may be right truncated
			if (i === len) {
				
				if (slen > maxseg) {
					
					segment = segment.substr(0, maxseg - 4) + ' ...';
					
				}
				
			// first segment may be left truncated
			} else if (i === 0) {
				
				if (slen > maxseg) {
					
					segment = '... ' + segment.substr(slen - maxseg - 4);
					
				}
				
			// middle segments may have middles shortened
			} else {
				
				if (slen > doubleseg) {
					
					segment =
						segment.substr(0, maxseg - 3) + 
						" ... " + 
						segment.substr(slen - maxseg - 3);
					
				}
				
			}
			
		}
		
		// add segment to buffer
		buf[buf.length] = segment;
		size += segment.length;
		
		// add term to buffer
		if (i < len) {
			
			term = index[loc];
			buf[buf.length] = '<b>' + text.substr(loc, term.length) + '</b>';
			size += term.length;
			pos = loc + term.length;
			
		}
		
		// increment flat iterator
		i++;
	}
	
	// trailing ellipse if early break
	if (size >= maxsize && i <= len) {
		buf[buf.length] = " ...";
	}
	
	// concatenate buffer to get output string
	return buf.join('');
	
}

// exports
tenk.highlight = highlight;

})(window['10kse'],jQuery);

/**
 * autocomplete.js - stripped-down implementation of autocomplete.
 */
(function(window,tenk,$,undefined){

/**
 * get array of suggestions based on input string.
 * @param {string} query The value entered for which to find suggestions.
 */
function suggestions(query) {
	
	// TODO: implement me!!
	
}

/**
 * autocomplete instrumentation.
 * @param {element} input The input element to autocomplete.
 */
function autocomplete(input) {
	
	// create drop-down structure
	
	// capture keyup and change on input
		
		// clear timeout if already set
		
		// set timeout for duration, then update choices
		
	// update choices
		
		// get suggestions
		
		// fill in suggestions in drop-down
		
	
}

// exports
tenk.autocomplete = autocomplete;
tenk.suggestions = suggestions;

})(window,window['10kse'],jQuery);
/**
 * search.js
 */
(function(window,document,tenk,$,undefined){

var
	
	// storage api
	get = tenk.get,
	
	// stop words
	stop = tenk.stop,
	
	// serialization api
	stringify = JSON.stringify,
	
	// cached jquery results
	$results = $('.results dl'),
	$input = $('.search input');

/**
 * search form behavior
 */
function search(e) { 
	
	e.preventDefault();
	
	var
		
		// retrieve search query
		query = $input.val() || '',
		
		// extract terms from supplied search input string
		terms = query.toLowerCase().split(/[^a-z0-9_]/),
		
		// iteration vars
		i,
		l,
		term,
		record,
		
		// matching document ids
		ids = {},
		id,
		
		// record cache
		recordcache = {};
	
	// collect matching document ids
	for (i=0, l=terms.length; i<l; i++) {
		
		term = terms[i];
		
		if (!recordcache[term]) {
			record = recordcache[term] = get("W-" + term);
			if (record) {
				for (id in record) {
					ids[id] = (ids[id] || 0) + 1;
				}
			}
		}
		
	}
	
	var
		
		// references to library functions
		wordcount = tenk.wordcount,
		normalize = tenk.normalize,
		
		// scoring
		rankings = [
			
			// count the number of terms in the query which appear at least once
			[1.0, normalize(ids)],
			
			// count number of times terms appear in the documents
			[1.0, normalize(wordcount(ids, terms, "s", recordcache))],
			[1.0, normalize(wordcount(ids, terms, "t", recordcache))],
			[1.0, normalize(wordcount(ids, terms, "p", recordcache))],
			[1.0, normalize(wordcount(ids, terms, "c", recordcache))]
			
		],
		
		totals = {};
	
	// aggregate scores
	for (i=0, l=rankings.length; i<l; i++) {
		
		var
			pair = rankings[i],
			weight = pair[0],
			scores = pair[1];
		
		for (id in scores) {
			
			if (!totals[id]) {
				totals[id] = 0;
			}
			
			totals[id] += weight * scores[id];
			
		}
	}
	
	var
		
		// list of scores, and count of number
		ranks = [],
		count = 0,
		
		// inverted index mapping scores to ids
		inverse = {},
		
		// weighted total score
		score,
		
		// entry in the inverse ranks table
		entry;
	
	// invert id/scores for display
	for (id in totals) {
		score = totals[id];
		entry = inverse[score] || (inverse[score] = []);
		entry[entry.length] = id;
		ranks[count++] = score;
	}
	
	// sort matches by rank, descending
	ranks.sort(tenk.asc);
	ranks.reverse();
	
	// Implement these raw score algorithms (input term and document, output score number):
	//   * count of terms present in text (simple hit count)
	//   * word distance from beginning of document to first hit 
	//   * distance between term words in matching document (only for multi-term searches)
	//  for each of these categories:
	//   * title
	//   * selection
	//   * priority
	//   * content
	
	var
		
		// highlight function
		highlight = tenk.highlight,
		
		// last score 
		last = null;
	
	// display search results in rank order, highlighted accordingly
	$results.empty();
	for (i=0, l=ranks.length; i<l; i++) {
		
		score = ranks[i];
		if (score !== last) {
			
			last = score;
			entry = inverse[score];
			
			for (var j=0, m=entry.length; j<m; j++) {
				
				id = entry[j];
				
				var
					url = get("ID-" + id),
					doc = get("URL-" + url),
					text = doc.text;
				
				$results.append(
					$('<dt><a></a></dt>')
						.find('a')
							.attr('href', url)
							.attr('title', doc.title)
							.html(highlight(doc.title, terms, false))
						.end(),
					$('<dd><p></p></dd>')
						.find('p')
							.html(highlight(text, terms))
						.end()
						.append('<p><strong>Score: ' + (totals[id] + '').substr(0,4) + '</strong></p>')
				);
				
			}
			
		}
		
	}
	
}

// attach search action to form submission
$('form').submit(search);

// focus on the search input
$(function(){
	$input.focus();
});

})(window,document,window['10kse'],jQuery);

