module("Basics", {
  setup: function() {
    Optiscroll.globalSettings.checkFrequency = 300;
    os = new window.Optiscroll(document.querySelector('#os'));
  }, teardown: function() {
    os = null;
  }
});


test("It should be initialized", function () {
  equal(typeof os, 'object');
  // check DOM elements
  equal(os.element.toString(), '[object HTMLDivElement]');
  equal(os.scrollEl.toString(), '[object HTMLDivElement]');
  // check globals
  equal(Optiscroll.G.instances.length, 1);
  ok(Optiscroll.G.checkTimer);
});


asyncTest("Optiscroll should be destroyed", function () {
  expect(4);
  os.destroy();

  setTimeout(function () {
    // check DOM elements style
    ok( !os.scrollEl.getAttribute('style') );
    ok( !os.scrollEl.getAttribute('data-scroll') );
    // check globals
    equal(Optiscroll.G.instances.length, 0);
    equal(Optiscroll.G.checkTimer, null);
    start();
  }, 700);
});


asyncTest("Optiscroll should auto update itself", function () {
  expect(4);
  os.element.style.width = '300px';
  os.element.style.height = '300px';

  setTimeout(function () {
    equal(os.cache.clientW, 300);
    equal(os.cache.clientH, 300);
    equal(os.cache.scrollW, 300);
    equal(os.cache.scrollH, 300);

    start();
  }, 700);
});


asyncTest("Optiscroll should auto destroy itself", function () {
  expect(2);
  os.element.parentNode.removeChild(os.element);

  setTimeout(function () {
    // check globals
    equal(Optiscroll.G.instances.length, 0);
    equal(Optiscroll.G.checkTimer, null);
    start();
  }, 1000);
});