var shuffle = require('./util').shuffle;
var replaceOn = require('./util').replaceOn;
var commonStartingString = require('./util').commonStartingString;

function Shabdawali(targetEl, opts){
    this.element = targetEl;
    this.lines = opts.lines;
    this.playCount = -1;
    this.onChar = opts.onCharChange || function(){};
    this.onLine = opts.onLineChange || function(){};
    this.nextWord = opts.nextWord || function(){};

    this.speed = opts.typingSpeed || 70;
    this.timeToReadAWord = 80;
    this.dynamicPauseBeforeDelete = opts.dynamicPauseBeforeDelete || true; 
    this.pauseBeforeDelete = opts.pauseBeforeDelete || 2000; 
    this.pauseBeforeNext = opts.pauseBeforeNext || 1000; 
    this.delay = opts.delay || 0; //initial delay

    this.typoEffect = opts.typoEffect || false;

    this.deleteSpeed = opts.deleteSpeed || (this.speed / 2);
    this.deleteSpeedArr = [];
    this.deleteUpto = [];

    this.repeat = opts.repeat || true;
    this.deleteEffect = opts.deleteEffect || true;

    if(opts.deleteFrom === "start"){
        this.trimmedText = function(text,len){ return text.substring(1); }
    }else{
        this.trimmedText = function(text,len){ return text.substring(0, len); }
    }
    

    //updateDynamicDeleteSpeed and deleteUpto
    for(var i = 0; i < this.lines.length; i++){
        var line = this.lines[i];
        if(opts.replacable){
            if(i < this.lines.length - 1){
                var commonUpto = commonStartingString(line, this.lines[ i+1 ])
                this.deleteUpto.push(commonUpto || 0);
            }else{
                this.deleteUpto.push(0);//delete upto 1st char
            }
        }else{
            this.deleteUpto.push(0);//delete upto 1st char
        }

        this.deleteSpeedArr.push( opts.deleteSpeed || (this.deleteSpeed  - ( line.length - this.deleteUpto[i] ) ) );
        if( this.deleteSpeedArr[i] < 5 ) this.deleteSpeedArr[i] = 5;
    }
    
    
    this.typo = {//TO DO make it configurable
        max : 1,
        minWordLength : 5,
        goAheadLimit : 3,
        skip : 2,
        randomFactor : 4 //higher 
    }
    
    
    this._pauseCallBack;

    this.events = {
        "pause" : [],
        "resume" : []
    }
}

//Check if the given word should be used for spelling correction effects
Shabdawali.prototype.makeTypo = function(word){//TO DO make it configurable
    return shuffle( word.substr( this.typo.skip ));
}

Shabdawali.prototype.checkIfFitsForTypoEffect = function(word){//TO DO make it configurable
    if (Math.floor((Math.random() * this.typo.randomFactor) + 1) !== 2){
        return false;
    }
    
    if(word.length >= this.typo.minWordLength){
        return true;
    }
}

Shabdawali.prototype.start = function(count){
    this._stopped = false;
    this.currentLineIndex = 0;
    this.currentLetterIndex = 0;
    this.nextWordIndex = 0;
    this.typoCount = 0;
    this.startCorrectingAt = -1;
    if(count && count <= this.lines.length ){
        this.playCount = count;
    }else{
        this.playCount = -1;
    }
    this.element.textContent = '';
    this.typeNext();
}

Shabdawali.prototype.stop = function(){
    this._stopped = true;
}

Shabdawali.prototype.pause = function(){
    this._paused = true;
    this._emit("pause");
}
Shabdawali.prototype.resume = function(count){
    if(count && count <= this.lines.length ){
        this.playCount = count;
    }else{
        this.playCount = -1;
    }
    this._paused = false;
    this._pauseCallBack && setTimeout(this._pauseCallBack, this.pauseUntil);
    this._pauseCallBack = null;

    //repeat when on end
    if(this.currentLineIndex === this.lines.length){
        this.start(count);
    }
    this._emit("resume");
}

Shabdawali.prototype.deleteText = function(cLine){
    if(this._stopped){
        return;
    }else if(this._paused){
        var that = this;
        this._pauseCallBack = function() {
            that.deleteText(cLine);
        }
    }else if(this.correctingText && this.typoRange === 0){
        this.typeText( this.lines[this.currentLineIndex - 1] );
        this.correctingText = false;
    }else if(this.correctingText && this.typoRange > 0){
        this.delete(cLine, this.speed);
        this.typoRange--;
    }else if(this.currentLetterIndex === this.deleteUpto[this.currentLineIndex - 1 ] ){
        this.typeNext();
    }else{
        this.delete(cLine, this.deleteSpeedArr[ this.currentLineIndex -1 ]);
    }
}

Shabdawali.prototype.delete = function(cLine, speed){
    this.onChar("BS");
    this.element.textContent = this.trimmedText(cLine, --this.currentLetterIndex);
    var that = this;
    setTimeout(function() {
        that.deleteText(cLine);
    }, speed);
}


Shabdawali.prototype.typeText = function(cLine){
    if(this._stopped){
        return;
    }else if(this._paused){
        var that = this;
        this._pauseCallBack = function() {
            that.typeText(cLine);
        }
    }else if(cLine){
        if(this.currentLetterIndex === cLine.length){//complete line has been typed
            if(this.typoEffect && this.startCorrectingAt > 0 && this.startCorrectingAt === this.currentLetterIndex){
                this.startCorrectingAt = -1;
                this.correctingText = true;
                this.deleteText(cLine);
            }else if(this.deleteEffect){
                var gape = this.pauseBeforeDelete;
                if(this.dynamicPauseBeforeDelete){
                    gape = this.timeToReadAWord * (cLine.length / 4);
                    if(gape < 2000) gape = 2000;
                }
                var that = this;
                setTimeout(function() {
                    that.deleteText(cLine);
                }, gape );
            }else{
                this.typeNext();
            }
        }else{//still typing
            if( this.typoEffect && this.currentLetterIndex === this.nextWordIndex && this.typoCount < this.typo.max){
                var nextSpaceIndex = cLine.indexOf(' ', this.nextWordIndex);
                //var goAheadLimit = this.typo.goAheadLimit;
                if(nextSpaceIndex === -1) { 
                    nextSpaceIndex = cLine.length + 1;
                    //goAheadLimit = -1;
                }
                var word = cLine.substr(this.nextWordIndex, nextSpaceIndex - this.nextWordIndex);
                this.nextWord(word);//callBack
                if( this.checkIfFitsForTypoEffect(word) ){
                    var typoWord = this.makeTypo( word ) ;
                    cLine = replaceOn(cLine, this.currentLetterIndex + this.typo.skip , typoWord);
                    this.typoCount++;
                    this.typoRange =  word.length;// + goAheadLimit;
                    this.startCorrectingAt = this.currentLetterIndex + this.typoRange ;
                }
                this.nextWordIndex = nextSpaceIndex + 1;
            }

            if(this.typoEffect && this.startCorrectingAt > 0 && this.startCorrectingAt === this.currentLetterIndex){
                this.startCorrectingAt = -1;
                this.correctingText = true;
                this.deleteText(cLine);
            }else{
                var char = cLine.substr( this.currentLetterIndex++ , 1);
                this.onChar( char );
                this.element.textContent  += char;
                var that = this;
                setTimeout(function() {
                    that.typeText(cLine);
                }, this.speed );
            }

        }
    }
}

Shabdawali.prototype.nextLine = function(){
    if(this.currentLineIndex === this.lines.length){
        if(this.repeat) this.currentLineIndex = 0;
    }
    var line =  this.lines[ this.currentLineIndex ];
    this.onLine("CR", this.currentLineIndex, line);
    this.currentLineIndex++;
    return line;
}

Shabdawali.prototype.typeNext = function(){
    if(this.playCount === 0){
        this.pause();
        var that = this;
        this._pauseCallBack = function() {
            that.typeNext();
        }
        return;
    }else if(this.playCount > 0){
        this.playCount--;
    }else {

    }
    this.nextWordIndex = 0;
    this.typoCount = 0;
    var line = this.nextLine();
    this.currentLetterIndex = this.deleteUpto[ this.currentLineIndex - 2 ] || 0;
    var that = this;
    line && (
        setTimeout(function() {
            //that.element.textContent = '';
            that.typeText(line) ;
        }, this.pauseBeforeNext)
    );
}

Shabdawali.prototype._emit = function(eventName){
    for(var i=0; i< this.events[eventName].length; i++){
        this.events[eventName][i]();
    }
}
Shabdawali.prototype.on = function(eventName, fn){
    this.events[eventName].push(fn);
}



module.exports = function(targetEl, opts){
    return new Shabdawali(targetEl, opts);
}
