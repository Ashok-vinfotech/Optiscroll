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
