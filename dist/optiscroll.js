/*!
* Optiscroll.js v1.0.1
* https://github.com/wilsonfletcher/Optiscroll/
* by Alberto Gasparin
* 
* @copyright 2014 Wilson Fletcher
* @license Released under MIT LICENSE
*/

;(function ( window, document, Math, undefined ) {
  'use strict';

/*
 * CustomEvent polyfill for IE9
 * By MDN
 * https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
 * MIT LICENSE
 */

typeof window.CustomEvent === 'function' || (function (window) {

  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
  }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;

})(window);


/**
 * Optiscroll, use this to create instances
 * ```
 * var scrolltime = new Optiscroll(element);
 * ```
 */
var Optiscroll = function Optiscroll(element, options) {
  return new Optiscroll.Instance(element, options || {});
};


  
var GS = Optiscroll.globalSettings = {
  scrollMinUpdateInterval: 1000 / 40, // 40 FPS
  checkFrequency: 1000,
  pauseCheck: false
};

Optiscroll.defaults = {
  preventParentScroll: false,
  forceScrollbars: false,
  scrollStopDelay: 300,
  maxTrackSize: 95,
  minTrackSize: 5,
  draggableTracks: true,
  autoUpdate: true,
  classPrefix: 'optiscroll'
};



Optiscroll.Instance = function ( element, options ) {
  var me = this;
  
  me.element = element;
  me.scrollEl = element.children[0];
  
  // instance variables
  me.settings = _extend( _extend({}, Optiscroll.defaults), options || {});
  
  me.cache = {};
  
  me.init();
};



Optiscroll.Instance.prototype.init = function () {
  var me = this,
      settings = me.settings;

  // add instance to global array for timed check
  if(settings.autoUpdate) {
    G.instances.push( me );
  }

  // initialize scrollbars
  me.scrollbars = { 
    v: new Scrollbar('v', me), 
    h: new Scrollbar('h', me) 
  };

  // disable forced scrollbars if Firefox 
  // because we cannot hide native scrollbars yet
  if(G.nativeScrollbarSize === 0 && 'mozRequestAnimationFrame' in window) {
    settings.forceScrollbars = false;
  }

  // create DOM scrollbars only if they have size or if it's forced
  if(G.nativeScrollbarSize || settings.forceScrollbars) {
    Utils.hideNativeScrollbars(me.scrollEl);
    _invoke(me.scrollbars, 'create');
  } 

  if(G.isTouch && settings.preventParentScroll) {
    toggleClass(me.element, settings.classPrefix+'-nobounce', true);
  }

  // calculate scrollbars
  me.update();

  // bind container events
  me.bind();

  // start the timed check if it is not already running
  if(settings.autoUpdate && !G.checkTimer) {
    Utils.checkLoop();
  }

};

  

Optiscroll.Instance.prototype.bind = function () {
  var me = this,
      listeners = me.listeners = {},
      scrollEl = me.scrollEl;

  // scroll event binding
  listeners.scroll = _throttle(function (ev) { 
    Events.scroll(ev, me); 
  }, GS.scrollMinUpdateInterval);

  // overflow events bindings (non standard, moz + webkit)
  // to update scrollbars immediately 
  listeners.overflow = listeners.underflow = listeners.overflowchanged = function (ev) { me.update(); };

  if(G.isTouch) {
    listeners.touchstart = function (ev) { Events.touchstart(ev, me); };
    listeners.touchend = function (ev) { Events.touchend(ev, me); };
  }

  if(me.settings.preventParentScroll) {
     // Safari does not support wheel event
    listeners.mousewheel = listeners.wheel = function (ev) { Events.wheel(ev, me); };
  }

  for (var ev in listeners) {
    scrollEl.addEventListener(ev, listeners[ev]);
  }

};




Optiscroll.Instance.prototype.update = function () {
  var me = this,
      oldcH = me.cache.clientH,
      scrollEl = me.scrollEl,
      cache = me.cache,
      sH = scrollEl.scrollHeight,
      cH = scrollEl.clientHeight,
      sW = scrollEl.scrollWidth,
      cW = scrollEl.clientWidth;
  
  if( sH !== cache.scrollH || cH !== cache.clientH || 
    sW !== cache.scrollW || cW !== cache.clientW ) {
    
    // if the element is no more in the DOM
    if(sH === 0 && cH === 0 && !document.body.contains(me.element)) {
      me.destroy();
      return false;
    }

    cache.scrollH = sH;
    cache.clientH = cH;
    cache.scrollW = sW;
    cache.clientW = cW;

    // only fire if cache was defined
    if( oldcH !== undefined ) {
      me.fireCustomEvent('sizechange');
    }

    // this will update the scrollbar
    // and check if bottom is reached
    _invoke(me.scrollbars, 'update');
  }
};




/**
 * Animate scrollTo
 * ```
 * $(el).optiscroll('scrollTo', 'left', 100, 200) // scrolls x,y in 200ms
 * ```
 */
Optiscroll.Instance.prototype.scrollTo = function (destX, destY, duration, disableEvents) {
  var me = this,
      cache = me.cache,
      startX, startY, endX, endY;

  G.pauseCheck = true;
  // force update
  me.update();

  startX = me.scrollEl.scrollLeft;
  startY = me.scrollEl.scrollTop;
  
  endX = +destX;
  if(destX == 'left') { endX = 0; }
  if(destX == 'right') { endX = cache.scrollW - cache.clientW; }
  if(destX === false) { endX = startX; }

  endY = +destY;
  if(destY == 'top') { endY = 0; }
  if(destY == 'bottom') { endY = cache.scrollH - cache.clientH; }
  if(destY === false) { endY = startY; }

  me.disableScrollEv = disableEvents;

  // animate
  me.animateScroll(startX, endX, startY, endY, +duration);
  
};


Optiscroll.Instance.prototype.scrollIntoView = function (elem, duration, delta) {
  var me = this,
      scrollEl = me.scrollEl,
      eDim, sDim,
      leftEdge, topEdge, rightEdge, bottomEdge,
      startX, startY, endX, endY;

  G.pauseCheck = true;
  // force update
  me.update();

  if(typeof elem === 'string') { // selector
    elem = scrollEl.querySelector(elem);
  } else if(elem.length && elem.jquery) { // jquery element
    elem = elem[0];
  }

  if(typeof delta === 'number') { // same delta for all
    delta = { top:delta, right:delta, bottom:delta, left:delta };
  }

  delta = delta || {};
  eDim = elem.getBoundingClientRect();
  sDim = scrollEl.getBoundingClientRect();

  startX = endX = scrollEl.scrollLeft;
  startY = endY = scrollEl.scrollTop;
  leftEdge = startX + eDim.left - sDim.left - (delta.left || 0);
  topEdge = startY + eDim.top - sDim.top - (delta.top || 0);
  rightEdge = startX + eDim.left - sDim.left + eDim.width - me.cache.clientW + (delta.right || 0);
  bottomEdge = startY + eDim.top - sDim.top + eDim.height - me.cache.clientH + (delta.bottom || 0);
  
  if(leftEdge < startX) { endX = leftEdge; }
  if(rightEdge > startX) { endX = rightEdge; }

  if(topEdge < startY) { endY = topEdge; }
  if(bottomEdge > startY) { endY = bottomEdge; }

  // animate
  me.animateScroll(startX, endX, startY, endY, +duration);
};




Optiscroll.Instance.prototype.animateScroll = function (startX, endX, startY, endY, duration) {
  var me = this,
      scrollEl = me.scrollEl,
      startTime = Date.now();

  if(endX === startX && endY === startY) {
    return;
  }

  if(duration === 0) {
    scrollEl.scrollLeft = endX;
    scrollEl.scrollTop = endY;
    animationTimeout( function () { me.disableScrollEv = false; }); // restore
    return;
  }

  if(isNaN(duration)) { // undefined or auto
    // 500px in 430ms, 1000px in 625ms, 2000px in 910ms
    duration = Math.pow( Math.max( Math.abs(endX - startX), Math.abs(endY - startY) ), 0.54) * 15;
  }

  var scrollAnimation = function () {
    var time = Math.min(1, ((Date.now() - startTime) / duration)),
        easedTime = Utils.easingFunction(time);
    
    if( endY !== startY ) {
      scrollEl.scrollTop = (easedTime * (endY - startY)) + startY;
    }
    if( endX !== startX ) {
      scrollEl.scrollLeft = (easedTime * (endX - startX)) + startX;
    }

    if(time < 1) {
      animationTimeout(scrollAnimation);
    } else {
      me.disableScrollEv = false;
      // now the internal scroll event will fire
    }
  };
  
  animationTimeout(scrollAnimation);
};




Optiscroll.Instance.prototype.destroy = function () {
  var me = this,
      scrollEl = me.scrollEl,
      listeners = me.listeners,
      index = G.instances.indexOf( me );

  // unbind events
  for (var ev in listeners) {
    scrollEl.removeEventListener(ev, listeners[ev]);
  }

  // remove scrollbars elements
  _invoke(me.scrollbars, 'remove');
  
  // restore style
  scrollEl.removeAttribute('style');
  scrollEl.removeAttribute('data-scroll');

  // remove classes
  toggleClass(me.element, me.settings.classPrefix+'-nobounce', false);
  
  // defer instance removal from global array
  // to not affect checkLoop _invoke
  if (index > -1) {
    animationTimeout(function () {
      G.instances.splice(index, 1);
    });
  }
};




Optiscroll.Instance.prototype.fireCustomEvent = function (eventName) {
  var eventData = Utils.exposedData(this.cache),
      cEvent = new CustomEvent(eventName, { detail: eventData });
  
  this.element.dispatchEvent(cEvent);
};




var Events = {

  scroll: function (ev, me) {
    if(me.disableScrollEv) { return; }

    if (!G.pauseCheck) {
      me.fireCustomEvent('scrollstart');
    }
    G.pauseCheck = true;
    
    _invoke(me.scrollbars, 'update');
    
    clearTimeout(me.cache.timerStop);
    me.cache.timerStop = setTimeout(function () {
      Events.scrollStop(me);
    }, me.settings.scrollStopDelay);
  },


  touchstart: function (ev, me) {
    G.pauseCheck = false;
    if(me.settings.preventParentScroll) {
      _invoke(me.scrollbars, 'update', [true]);
    }
  },


  touchend: function (ev, me) {
    // prevents touchmove generate scroll event to call
    // scrollstop  while the page is still momentum scrolling
    clearTimeout(me.cache.timerStop);
  },


  scrollStop: function (me) {
    // fire custom event
    me.fireCustomEvent('scrollstop');

    // restore check loop
    G.pauseCheck = false;
  },


  wheel: function (ev, me) {
    // prevents scrolling only on Y axis 
    // due to complexity on getting scroll direction
    var cache = me.cache,
        // deltaX = ev.deltaX || -ev.wheelDeltaX/3 || 0,
        deltaY = ev.deltaY || -ev.wheelDeltaY/3 || 0,
        // percentX, 
        percentY;
    
    // fix Firefox returning float numbers
    // deltaX = deltaX > 0 ? Math.ceil(deltaX) : Math.floor(deltaX);
    deltaY = deltaY > 0 ? Math.ceil(deltaY) : Math.floor(deltaY);

    // percentX = cache.h.percent + deltaX / cache.scrollW;
    percentY = ~~cache.v.percent + deltaY / cache.scrollH;

    if( //(deltaX && (percentX <= 0 || percentX >= 100)) || 
        (deltaY && (percentY <= 0 || percentY >= 100))) {
      ev.preventDefault();
    }
    ev.stopPropagation();
  }


};


var Scrollbar = function (which, instance) {

  var isVertical = (which === 'v'),
      parentEl = instance.element,
      scrollEl = instance.scrollEl,
      settings = instance.settings,
      cache = instance.cache,
      scrollbarCache = cache[which] = {},

      sizeProp = isVertical ? 'H' : 'W',
      clientSize = 'client'+sizeProp,
      scrollSize = 'scroll'+sizeProp,
      scrollProp = isVertical ? 'scrollTop' : 'scrollLeft',
      evNames = isVertical ? ['top','bottom'] : ['left','right'],
      trackTransition = 'height 0.2s ease 0s, width 0.2s ease 0s, opacity 0.2s ease 0s',

      enabled = false,
      scrollbarEl = null,
      trackEl = null,
      dragData = null,
      animated = false;

  var events = {
    dragData: null,

    dragStart: function (ev) {
      var evData = ev.touches ? ev.touches[0] : ev;
      events.dragData = { x: evData.pageX, y: evData.pageY, scroll: scrollEl[scrollProp] };
    },

    dragMove: function (ev) {
      var evData = ev.touches ? ev.touches[0] : ev,
          delta, deltaRatio;
      
      if(!events.dragData) { return; }

      ev.preventDefault();
      delta = isVertical ? evData.pageY - events.dragData.y : evData.pageX - events.dragData.x;
      deltaRatio = delta / cache[clientSize];
      
      scrollEl[scrollProp] = events.dragData.scroll + deltaRatio * cache[scrollSize];
    },

    dragEnd: function (ev) {
      events.dragData = null;
    }
  }
  
  return {


    toggle: function (bool) {
      enabled = bool;

      if(trackEl) {
        toggleClass(parentEl, which+'track-on', enabled);

        if(enabled) {
          trackEl.style[G.cssTransition] = trackTransition;
        }
      }

      // expose enabled
      scrollbarCache.enabled = enabled;
    },


    create: function () {
      scrollbarEl = document.createElement('div');
      trackEl = document.createElement('b');

      scrollbarEl.className = settings.classPrefix+'-'+which;
      trackEl.className = settings.classPrefix+'-'+which+'track';
      scrollbarEl.appendChild(trackEl);
      parentEl.appendChild(scrollbarEl);

      if(settings.draggableTracks) {
        this.bind(true);
      }
    },


    update: function (isOnTouch) {
      var me = this,
          trackMin = settings.minTrackSize || 0,
          trackMax = settings.maxTrackSize || 100,
          newDim, newRelPos, deltaPos;

      newDim = this.calc(scrollEl[scrollProp], cache[clientSize], cache[scrollSize], trackMin, trackMax);
      newRelPos = ((1 / newDim.size) * newDim.position * 100);
      deltaPos = Math.abs(newDim.position - (scrollbarCache.position || 0)) * cache[clientSize];

      if(newDim.size === 1 && enabled) {
        me.toggle(false);
      }

      if(newDim.size < 1 && !enabled) {
        me.toggle(true);
      }

      if(trackEl && enabled) {
        if(scrollbarCache.size !== newDim.size) {
          trackEl.style[ isVertical ? 'height':'width' ] = newDim.size * 100 + '%';
        }

        if(deltaPos) { // only if position has changed
          me.animateTrack( G.isTouch && deltaPos > 20 );
          trackEl.style[G.cssTransform] = 'translate(' + (isVertical ?  '0%,'+newRelPos+'%' : newRelPos+'%'+',0%') +')';
        }
      }

      // update cache values
      scrollbarCache = _extend(scrollbarCache, newDim);

      me.checkEdges(isOnTouch);
    },


    animateTrack: function (animatePos) {
      if(animatePos || animated) {
        trackEl.style[G.cssTransition] = trackTransition + (animatePos ? ', '+ G.cssTransformDashed + ' 0.2s linear 0s' : '');
      }
      animated = animatePos;
    },


    bind: function (on) {
      var method = (on ? 'add' : 'remove') + 'EventListener',
          type = G.isTouch ? ['touchstart', 'touchmove', 'touchend'] : ['mousedown', 'mousemove', 'mouseup'];

      if (trackEl) { trackEl[method](type[0], events.dragStart); }
      document[method](type[1], events.dragMove);
      document[method](type[2], events.dragEnd);
      
    },


    calc: function (position, viewSize, scrollSize, min, max) {
      var minTrackR = min / 100,
          maxTrackR = max / 100,
          sizeRatio, positionRatio, percent;

      sizeRatio = viewSize / scrollSize;

      if(sizeRatio === 1 || scrollSize === 0) { // no scrollbars needed
        return { position: 0, size: 1, percent: 0 };
      }

      positionRatio = position / scrollSize;
      percent = 100 * position / (scrollSize - viewSize);

      if( sizeRatio > maxTrackR ) {
        positionRatio += (sizeRatio - maxTrackR) * (percent / 100);
        sizeRatio = maxTrackR;
      }

      if( sizeRatio < minTrackR ) {
        positionRatio += (sizeRatio - minTrackR) * (percent / 100);
        sizeRatio = minTrackR;
      }

      if(percent < 0) { // overscroll
        positionRatio = 0;
      }

      if(percent > 100) { // overscroll
        positionRatio = 1 - sizeRatio;
      }
      
      return { position: positionRatio, size: sizeRatio, percent: percent };
    },


    checkEdges: function (isOnTouch) {
      var percent = scrollbarCache.percent, scrollFixPosition;

      if(!enabled) { return; }

      if(scrollbarCache.was !== percent && percent % 100 === 0 && !isOnTouch) {
        instance.fireCustomEvent('scrollreachedge');
        instance.fireCustomEvent('scrollreach'+ evNames[percent/100] );
      }

      if(percent % 100 === 0 && isOnTouch && settings.preventParentScroll) {
        scrollFixPosition = percent ? scrollbarCache.position * cache[scrollSize] - 1 : 1;
        instance.scrollTo( isVertical ? false : scrollFixPosition, isVertical ? scrollFixPosition : false , 0, true);
      }

      // if(percent > 0 && percent < 100) // update only if not overscroll
        scrollbarCache.was = percent;
    },


    remove: function () {
      // remove parent custom classes
      this.toggle(false);
      // unbind drag events
      this.bind(false);
      // remove elements
      if(scrollbarEl && scrollbarEl.parentNode) {
        scrollbarEl.parentNode.removeChild(scrollbarEl);
      }
    }


  };

};

var Utils = {

  hideNativeScrollbars: function (scrollEl) {
    var size = G.nativeScrollbarSize,
        scrollElStyle = scrollEl.style;
    if( size === 0 ) {
      // hide Webkit/touch scrollbars
      var time = Date.now();
      scrollEl.setAttribute('data-scroll', time);
      
      // force scrollbars update on Webkit
      scrollElStyle.display = 'none';
      
      if( G.isTouch ) {
        Utils.addCssRule('[data-scroll="'+time+'"]::-webkit-scrollbar', 'display: none;');
      } else {
        Utils.addCssRule('[data-scroll="'+time+'"]::-webkit-scrollbar', 'width: 0; height: 0;');
      }

      animationTimeout(function () { 
        scrollElStyle.display = 'block'; 
      });
      
    } else {
      // force scrollbars and hide them
      scrollElStyle.overflow = 'scroll';
      scrollElStyle.right = -size + 'px';
      scrollElStyle.bottom = -size + 'px';
    }
  },


  exposedData: function (obj) {
    var sH = obj.scrollH, sW = obj.scrollW;
    return {
      // scrollbars data
      scrollbarV: _extend({}, obj.v),
      scrollbarH: _extend({}, obj.h),

      // scroll position
      scrollTop: obj.v.position * sH,
      scrollLeft: obj.h.position * sW,
      scrollBottom: (1 - obj.v.position - obj.v.size) * sH,
      scrollRight: (1 - obj.h.position - obj.h.size) * sW,

      // element size
      scrollWidth: sW,
      scrollHeight: sH,
      clientWidth: obj.clientW,
      clientHeight: obj.clientH
    }
  },


  addCssRule: function (selector, rules) {
    var styleSheet = document.getElementById('scroll-sheet');

    if ( !styleSheet ) {
      styleSheet = document.createElement("style");
      styleSheet.id = 'scroll-sheet';
      document.head.appendChild(styleSheet);
    } 
    // do not use sheet.insertRule because FF throws an error
    // if the selector is not supported
    styleSheet.innerHTML += selector + "{" + rules + "} ";
  },


  // Global height checker
  // looped to listen element changes
  checkLoop: function () {
    
    if(!G.instances.length) {
      G.checkTimer = null;
      return;
    }

    if(!G.pauseCheck) { // check size only if not scrolling
      _invoke(G.instances, 'update');
    }
    
    if(GS.checkFrequency) {
      G.checkTimer = setTimeout(function () {
        Utils.checkLoop();
      }, GS.checkFrequency);
    }
  },


  // easeOutCubic function
  easingFunction: function (t) { 
    return (--t) * t * t + 1; 
  }


};


// Global variables
var G = Optiscroll.G = {
  isTouch: 'ontouchstart' in window,
  cssTransition: cssTest('transition'),
  cssTransform: cssTest('transform'),
  nativeScrollbarSize: getScrollbarWidth(),

  instances: [],
  checkTimer: null,
  pauseCheck: false
};

G.cssTransformDashed = (G.cssTransform === 'transform') ? G.cssTransform : '-'+G.cssTransform.replace('T','-t').toLowerCase();



var animationTimeout = (function () {
  return window.requestAnimationFrame || 
    window.webkitRequestAnimationFrame || 
    window.mozRequestAnimationFrame || 
    window.msRequestAnimationFrame || 
    function(callback){ window.setTimeout(callback, 1000/60); };
})();



// Get scrollbars width, thanks Google Closure Library
function getScrollbarWidth () {
  var htmlEl = document.documentElement,
      outerEl, innerEl, width = 0;

  outerEl = document.createElement('div');
  outerEl.style.cssText = 'overflow:auto;width:50px;height:50px;' + 'position:absolute;left:-100px';

  innerEl = document.createElement('div');
  innerEl.style.cssText = 'width:100px;height:100px';

  outerEl.appendChild(innerEl);
  htmlEl.appendChild(outerEl);
  width = outerEl.offsetWidth - outerEl.clientWidth;
  htmlEl.removeChild(outerEl);

  return width;
}


// Detect css3 support, thanks Modernizr
function cssTest (prop) {
  var ucProp  = prop.charAt(0).toUpperCase() + prop.slice(1),
      el = document.createElement( 'test' ),
      props   = (prop + ' ' + ['Webkit','Moz','O','ms'].join(ucProp + ' ') + ucProp).split(' ');

  for ( var i in props ) {
    if ( el.style[ props[i] ] !== undefined ) { return props[i]; }
  }
  return false;
}



function toggleClass (el, value, bool) {
  var classes = el.className.split(/\s+/),
      index = classes.indexOf(value);
  
  if(bool) {
    ~index || classes.push(value);
  } else {
    ~index && classes.splice(index, 1);
  }

  el.className = classes.join(" ");
}




function _extend (dest, src, merge) {
  for(var key in src) {
    if(!src.hasOwnProperty(key) || dest[key] !== undefined && merge) {
      continue;
    }
    dest[key] = src[key];
  }
  return dest;
}


function _invoke (collection, fn, args) {
  var i, j;
  if(collection.length) {
    for(i = 0, j = collection.length; i < j; i++) {
      collection[i][fn].apply(collection[i], args);
    }
  } else {
    for (i in collection) {
      collection[i][fn].apply(collection[i], args);
    }
  }
}

function _throttle(fn, threshhold) {
  var last, deferTimer;
  return function () {
    var context = this,
        now = Date.now(),
        args = arguments;
    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer);
      deferTimer = setTimeout(function () {
        last = now;
        fn.apply(context, args);
      }, threshhold);
    } else {
      last = now;
      fn.apply(context, args);
    }
  };
}



  // AMD export
  if(typeof define == 'function' && define.amd) {
    define(function(){
      return Optiscroll;
    });
  }
  
  // commonjs export
  if(typeof module !== 'undefined' && module.exports) {
    module.exports = Optiscroll;
  }
  
  window.Optiscroll = Optiscroll;

})(window, document, Math);