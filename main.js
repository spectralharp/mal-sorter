(function () {

    window.addEventListener("load", init);

    const URL = 'https://api.jikan.moe/v3/anime/';
    const FETCH_RETRY = 5;

    let anime = [];
    let currPass = 0;
    let currIndex = 0;
    let swapped = false;
    let loaded = false;
    

    function init() {
        id("file-input").addEventListener("change", handleFile);
        id('anime-a').querySelector('img').addEventListener('click', () => compare(true));
        id('anime-b').querySelector('img').addEventListener('click', () => compare(false));
        document.addEventListener('keydown', keyCompare);
    }

    function keyCompare(e) {
        switch(e.code) {
            case 'ArrowLeft':
                compare(true);
                break;
            case 'ArrowRight':
                compare(false);
                break;
            case 'Space':
                compare(false);
                break;
        }
    }

    function handleFile() {
        const fileList = this.files; 
        if(fileList.length > 0) {
            const file = fileList[0];
            const reader = new FileReader();
            reader.onload = processFile;
            reader.readAsText(file);
        }
    }
    
    function processFile(e) {
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(this.result.replace(/<!\[CDATA\[(.*)\]\]>/g, (match, content)=>content),"text/xml");        
        anime = JSON.parse(xml2json(xmlDoc, '')).myanimelist.anime.map(x => ({ "id": x.series_animedb_id, "score": parseInt(x.my_score), "title": x.series_title, "loaded": false })).sort((a, b) => a.score - b.score);

        // Skip anime that hasn't been rated
        while(anime.length > 0 && anime[0].score === 0) {
            anime.shift();
        }
        
        startComparing();
    }

    function startComparing() {
        currPass = 0;
        currIndex = 0;
        id('pass-count').textContent = currPass + 1;
        updateProgress();

        swapped = false;
        
        setCovers();
    }

    async function setCovers() {
        loaded = false;
        if(!anime[currIndex].loaded) {
            await fetchAnimeData(anime[currIndex], id('anime-a'), FETCH_RETRY);
        } else {
            processAnimeResponse(anime[currIndex], {}, id('anime-a'))
        }
        if(!anime[currIndex + 1].loaded) {
            await fetchAnimeData(anime[currIndex + 1], id('anime-b'), FETCH_RETRY);
        } else {
            processAnimeResponse(anime[currIndex + 1], {}, id('anime-b'))
        }
        loaded = true;
    }

    async function fetchAnimeData(currAnime, container, retry) {
        return fetch(URL + currAnime.id)
                    .then(checkStatus)
                    .then(resp => resp.json())
                    .then(data => processAnimeResponse(currAnime, data, container))
                    .catch(e => failAnimeResponse(currAnime, container, retry));
    }

    function processAnimeResponse(currAnime, data, container) {
        let img = container.querySelector('img');
        let title = container.querySelector('h2');
        let altTitle = container.querySelector('h3');

        if(!currAnime.loaded) {
            currAnime.title = data.title;
            currAnime.title_english = data.title_english;
            currAnime.image_url = data.image_url;
            currAnime.loaded = true;
        } 
        img.src = currAnime.image_url;
        title.textContent = currAnime.title_english;
        altTitle.textContent = currAnime.title;   
    }

    async function failAnimeResponse(anime, container,retry) {
        let img = container.querySelector('img');
        let title = container.querySelector('h2');
        let altTitle = container.querySelector('h3');

        img.src = "";
        title.textContent = anime.title;
        altTitle.textContent = "";
        if(retry > 0) 
        {
            console.log(`failed to load, retry ${FETCH_RETRY - retry + 1} / ${FETCH_RETRY}`)
            await new Promise((resolve) => setTimeout(resolve, 1000));
            fetchAnimeData(anime, container, retry - 1);
        }
    }

    function compare(swap) {
        if(!loaded) return;

        if(swap) {
            swapAnime();
        }
        
        currIndex++;
        if(currIndex < anime.length - currPass - 1) {
            setCovers();
        } else {
            // Reached the end of this pass
            currPass++;
            if (currPass < anime.length - 1 && swapped) {
                // Next pass
                currIndex = 0;
                id('pass-count').textContent = currPass + 1;
                setCovers();        
                console.log(anime);
            } else {
                // Done
                finishSort();
            }
        }
        updateProgress();
    }

    function swapAnime() {
        let tmp = anime[currIndex];
        anime[currIndex] = anime[currIndex + 1];
        anime[currIndex + 1] = tmp;
        swapped = true;
    } 
    
    function updateProgress() {
        let progress = id('compare-progress');
        if(currIndex > (anime.length - currPass - 1)) {
            progress.style.width = "100%";
            progress.textContent = "Done!";
        } else {
            progress.style.width = (currIndex / (anime.length - currPass - 1)) * 100 + "%";
            progress.textContent = currIndex + "/" + (anime.length - currPass - 1);
        }
    }

    function finishSort() {
        document.querySelector('.compare').classList.add('hidden');
        let tbody = id('sorted-body');
        for(let i = 0; i < anime.length; i++) {
            tbody.appendChild(generateRow(anime[i]));
        }
        document.querySelector('.result').classList.remove('hidden');
    }

    function generateRow(animeData) {
        let row = gen('tr');
        let title = gen('td');
        let score = gen('td');
        title.textContent = `${animeData.title} (${animeData.title_english})`;
        row.appendChild(title);
        row.appendChild(score);
        return row;
    }

    /* ---------------------- Helper ------------------------ */

    function id(_id) {
        return document.getElementById(_id);
    }

    function gen(nodeName) {
        return document.createElement(nodeName);
    }

    // Changes XML to JSON
    function xml2json(xml, tab) {
        var X = {
            toObj: function(xml) {
                var o = {};
                if (xml.nodeType==1) {   // element node ..
                    if (xml.attributes.length)   // element with attributes  ..
                    for (var i=0; i<xml.attributes.length; i++)
                        o["@"+xml.attributes[i].nodeName] = (xml.attributes[i].nodeValue||"").toString();
                    if (xml.firstChild) { // element has child nodes ..
                    var textChild=0, cdataChild=0, hasElementChild=false;
                    for (var n=xml.firstChild; n; n=n.nextSibling) {
                        if (n.nodeType==1) hasElementChild = true;
                        else if (n.nodeType==3 && n.nodeValue.match(/[^ \f\n\r\t\v]/)) textChild++; // non-whitespace text
                        else if (n.nodeType==4) cdataChild++; // cdata section node
                    }
                    if (hasElementChild) {
                        if (textChild < 2 && cdataChild < 2) { // structured element with evtl. a single text or/and cdata node ..
                            X.removeWhite(xml);
                            for (var n=xml.firstChild; n; n=n.nextSibling) {
                                if (n.nodeType == 3)  // text node
                                o["#text"] = X.escape(n.nodeValue);
                                else if (n.nodeType == 4)  // cdata node
                                o["#cdata"] = X.escape(n.nodeValue);
                                else if (o[n.nodeName]) {  // multiple occurence of element ..
                                if (o[n.nodeName] instanceof Array)
                                    o[n.nodeName][o[n.nodeName].length] = X.toObj(n);
                                else
                                    o[n.nodeName] = [o[n.nodeName], X.toObj(n)];
                                }
                                else  // first occurence of element..
                                o[n.nodeName] = X.toObj(n);
                            }
                        }
                        else { // mixed content
                            if (!xml.attributes.length)
                                o = X.escape(X.innerXml(xml));
                            else
                                o["#text"] = X.escape(X.innerXml(xml));
                        }
                    }
                    else if (textChild) { // pure text
                        if (!xml.attributes.length)
                            o = X.escape(X.innerXml(xml));
                        else
                            o["#text"] = X.escape(X.innerXml(xml));
                    }
                    else if (cdataChild) { // cdata
                        if (cdataChild > 1)
                            o = X.escape(X.innerXml(xml));
                        else
                            for (var n=xml.firstChild; n; n=n.nextSibling)
                                o["#cdata"] = X.escape(n.nodeValue);
                    }
                    }
                    if (!xml.attributes.length && !xml.firstChild) o = null;
                }
                else if (xml.nodeType==9) { // document.node
                    o = X.toObj(xml.documentElement);
                }
                else
                    alert("unhandled node type: " + xml.nodeType);
                return o;
            },
            toJson: function(o, name, ind) {
                var json = name ? ("\""+name+"\"") : "";
                if (o instanceof Array) {
                    for (var i=0,n=o.length; i<n; i++)
                    o[i] = X.toJson(o[i], "", ind+"\t");
                    json += (name?":[":"[") + (o.length > 1 ? ("\n"+ind+"\t"+o.join(",\n"+ind+"\t")+"\n"+ind) : o.join("")) + "]";
                }
                else if (o == null)
                    json += (name&&":") + "null";
                else if (typeof(o) == "object") {
                    var arr = [];
                    for (var m in o)
                    arr[arr.length] = X.toJson(o[m], m, ind+"\t");
                    json += (name?":{":"{") + (arr.length > 1 ? ("\n"+ind+"\t"+arr.join(",\n"+ind+"\t")+"\n"+ind) : arr.join("")) + "}";
                }
                else if (typeof(o) == "string")
                    json += (name&&":") + "\"" + o.toString() + "\"";
                else
                    json += (name&&":") + o.toString();
                return json;
            },
            innerXml: function(node) {
                var s = ""
                if ("innerHTML" in node)
                    s = node.innerHTML;
                else {
                    var asXml = function(n) {
                    var s = "";
                    if (n.nodeType == 1) {
                        s += "<" + n.nodeName;
                        for (var i=0; i<n.attributes.length;i++)
                            s += " " + n.attributes[i].nodeName + "=\"" + (n.attributes[i].nodeValue||"").toString() + "\"";
                        if (n.firstChild) {
                            s += ">";
                            for (var c=n.firstChild; c; c=c.nextSibling)
                                s += asXml(c);
                            s += "</"+n.nodeName+">";
                        }
                        else
                            s += "/>";
                    }
                    else if (n.nodeType == 3)
                        s += n.nodeValue;
                    else if (n.nodeType == 4)
                        s += "<![CDATA[" + n.nodeValue + "]]>";
                    return s;
                    };
                    for (var c=node.firstChild; c; c=c.nextSibling)
                    s += asXml(c);
                }
                return s;
            },
            escape: function(txt) {
                return txt.replace(/[\\]/g, "\\\\")
                        .replace(/[\"]/g, '\\"')
                        .replace(/[\n]/g, '\\n')
                        .replace(/[\r]/g, '\\r');
            },
            removeWhite: function(e) {
                e.normalize();
                for (var n = e.firstChild; n; ) {
                    if (n.nodeType == 3) {  // text node
                    if (!n.nodeValue.match(/[^ \f\n\r\t\v]/)) { // pure whitespace text node
                        var nxt = n.nextSibling;
                        e.removeChild(n);
                        n = nxt;
                    }
                    else
                        n = n.nextSibling;
                    }
                    else if (n.nodeType == 1) {  // element node
                    X.removeWhite(n);
                    n = n.nextSibling;
                    }
                    else                      // any other node
                    n = n.nextSibling;
                }
                return e;
            }
        };
        if (xml.nodeType == 9) // document node
            xml = xml.documentElement;
        var json = X.toJson(X.toObj(X.removeWhite(xml)), xml.nodeName, "\t");
        return "{\n" + tab + (tab ? json.replace(/\t/g, tab) : json.replace(/\t|\n/g, "")) + "\n}";
    }   
    
    function checkStatus(response) {
        if(response.ok) {
            return response;
        } else {
            return Promise.reject(new Error(response.status + ": " + response.statusText));
        }
    }

})();