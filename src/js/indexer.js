/**
 * indexer.js - responsible for extracting index worthy content from scanned content.
 */
(function(tenk,window){

// local references
var
	
	storage = window.localStorage,
	stringify = window.JSON.stringify,
	parse = window.JSON.parse,
	
	// anything that doesn't belong to a 'word'
	nonword = /[^0-9a-z_]+/i,
	
	// so-called "stop" words (uninteresting to search)
	stop = /able|about|across|after|all|almost|also|among|and|any|are|because|been|but|can|cannot|could|dear|did|does|either|else|ever|every|for|from|get|got|had|has|have|her|hers|him|his|how|however|into|its|just|least|let|like|likely|may|might|most|must|neither|nor|not|off|often|only|other|our|own|rather|said|say|says|she|should|since|some|than|that|the|their|them|then|there|these|they|this|tis|too|twas|wants|was|were|what|when|where|which|while|who|whom|why|will|with|would|yet|you|your/i;

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
		
		if (word.length > 2 && !(stop).test(word)) {
			
			lc = word.toLowerCase();
			
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
		if (data.content !== doc.text) {
			set("URL-" + data.url, {
				id: id,
				text: data.content
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
			text: data.content
		});
		
	}
	
	// index user's selected content
	if (data.selection) {
		update(id, "s", data.selection);
	}
	
	// index prioritized content
	if (data.priority) {
		update(id, "p", data.priority);
	}
	
	// index full content
	if (data.content) {
		update(id, "c", data.content);
	}
	
}

// export
tenk.extract = extract;
tenk.indexer = indexer;

})(window['10kse'],window);

