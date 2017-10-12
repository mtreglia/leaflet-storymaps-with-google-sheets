$(window).on('load', function() {
  var documentSettings = {};

  // This watches for the scrollable container
  var scrollPosition = 0;
  $('div#contents').scroll(function() {
    scrollPosition = $(this).scrollTop();
  });

  /**
   * Triggers the load of the spreadsheet and map creation
   */
   var mapData;

   $.ajax({
     url:'csv/Options.csv',
     type:'HEAD',
     error: function() {
       // Options.csv does not exist, so use Tabletop to fetch data from
       // the Google sheet
       mapData = Tabletop.init({
         key: googleDocURL,
         callback: function(data, mapData) { initMap(); }
       });
     },
     success: function() {
       // Get all data from .csv files
       mapData = Procsv;
       mapData.load({
         self: mapData,
         tabs: ['Options', 'Chapters'],
         callback: initMap
       });
     }
   });

  /**
  * Reformulates documentSettings as a dictionary, e.g.
  * {"webpageTitle": "Leaflet Boilerplate", "infoPopupText": "Stuff"}
  */
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }

  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getSetting(s) {
    return documentSettings[constants[s]];
  }

  /**
   * Returns the value of setting named s from constants.js
   * or def if setting is either not set or does not exist
   * Both arguments are strings
   * e.g. trySetting('_authorName', 'No Author')
   */
  function trySetting(s, def) {
    s = getSetting(s);
    if (!s || s.trim() === '') { return def; }
    return s;
  }

  /**
   * Loads the basemap and adds it to the map
   */
  function addBaseMap() {
    var basemap = trySetting('_tileProvider', 'Stamen.TonerLite');
    L.tileLayer.provider(basemap, {
      maxZoom: 18
    }).addTo(map);
  }

  function initMap() {
    var options = mapData.sheets(constants.optionsSheetName).elements;
    createDocumentSettings(options);

    /* Change narrative width */
    narrativeWidth = parseInt(getSetting('_narrativeWidth'));
    if (narrativeWidth > 0 && narrativeWidth < 100) {
      var mapWidth = 100 - narrativeWidth;

      $('#narration, #title').css('width', narrativeWidth + 'vw');
      $('#map').css('width', mapWidth + 'vw');
    }

    var chapterContainerMargin = 70;

    document.title = getSetting('_mapTitle');
    $('#title').append('<h3>' + getSetting('_mapTitle') + '</h3>');
    $('#title').append('<small>' + getSetting('_mapSubtitle') + '</small>');

    // Load tiles
    addBaseMap();

    // Add zoom controls if needed
    if (getSetting('_zoomControls') !== 'off') {
      L.control.zoom({
        position: getSetting('_zoomControls')
      }).addTo(map);
    }

    var chapters = mapData.sheets(constants.chaptersSheetName).elements;

    var markers = [];
    var pixelsAbove = [];

    for (i in chapters) {
      var c = chapters[i];
      // This creates numerical icons to match the ID numbers
      // OR remove the next 6 lines for default blue Leaflet markers
      var numericMarker = L.ExtraMarkers.icon({
        icon: 'fa-number',
        number: parseInt(i) + 1,
        markerColor: 'blue'
      });

      var marker = L.marker(
        [parseFloat(c['Latitude']), parseFloat(c['Longitude'])],
        {icon: numericMarker}
      );

      markers.push(marker);

      var image = $('<img>', {
        src: c['Image Link'],
      });

      var source = $('<a>', {
        text: c['Image Credit'],
        href: c['Image Credit Link'],
        target: "_blank",
        class: 'source'
      });

      var container = $('<div></div>', {
        id: 'container' + i,
        class: 'chapter-container'
      });

      var imgContainer = $('<div></div', {
        class: 'img-container'
      }).append(image);

      container
        .append('<p class="chapter-header">' + c['Chapter'] + '</p>')
        .append(imgContainer)
        .append(source)
        .append('<p class="description">' + c['Description'] + '</p>');

      $('#contents').append(container);
    }

    changeAttribution();

    /* Change image container heights */
    imgContainerHeight = parseInt(getSetting('_imgContainerHeight'));
    if (imgContainerHeight > 0) {
      $('.img-container').css({
        'height': imgContainerHeight + 'px',
        'max-height': imgContainerHeight + 'px',
      });
    }

    // Calculate heights
    pixelsAbove[0] = -100;
    for (i = 1; i < chapters.length; i++) {
      pixelsAbove[i] = pixelsAbove[i-1] + $('div#container' + (i-1)).height() + chapterContainerMargin;
    }
    pixelsAbove.push(Number.MAX_VALUE);

    $('div#contents').scroll(function() {
      for (i = 0; i < pixelsAbove.length - 1; i++) {
        if ($(this).scrollTop() >= pixelsAbove[i] && $(this).scrollTop() < (pixelsAbove[i+1] - 2 * chapterContainerMargin)) {
          $('.chapter-container').removeClass("in-focus").addClass("out-focus");
          $('div#container' + i).addClass("in-focus").removeClass("out-focus");
          map.flyTo([chapters[i]['Latitude'], chapters[i]['Longitude']], chapters[i]['Zoom']);
        }
      }
    });

    $('#contents').append(" \
      <div id='space-at-the-bottom'> \
        <a href='#space-at-the-top'>  \
          <i class='fa fa-chevron-up'></i></br> \
          <small>Top</small>  \
        </a> \
      </div> \
    ");

    /* Generate a CSS sheet with cosmetic changes */
    $("<style>")
      .prop("type", "text/css")
      .html("\
      #narration, #title {\
        background-color: " + trySetting('_narrativeBackground', 'white') + "; \
        color: " + trySetting('_narrativeText', 'black') + "; \
      }\
      a, a:visited, a:hover {\
        color: " + trySetting('_narrativeLink', 'blue') + " \
      }\
      .in-focus {\
        background-color: " + trySetting('_narrativeActive', '#f0f0f0') + " \
      }")
      .appendTo("head");


    endPixels = parseInt(getSetting('_pixelsAfterFinalChapter'));
    if (endPixels > 100) {
      $('#space-at-the-bottom').css({
        'height': (endPixels / 2) + 'px',
        'padding-top': (endPixels / 2) + 'px',
      });
    }

    var bounds = [];
    for (i in markers) {
      markers[i].addTo(map);
      markers[i].on('click', function() {
        $('div#contents').animate({scrollTop: pixelsAbove[i] + 'px'});
      });
      bounds.push(markers[i].getLatLng());
    }
    map.fitBounds(bounds);

    $('#map, #narration, #title').css('visibility', 'visible');
    $('div.loader').css('visibility', 'hidden');

    $('div#container0').addClass("in-focus");

    $('div#contents').animate({scrollTop: '1px'});
  }


  /**
   * Changes map attribution (author, GitHub repo, email etc.) in bottom-right
   */
  function changeAttribution() {
    var attributionHTML = $('.leaflet-control-attribution')[0].innerHTML;
    var credit = 'View <a href="' + googleDocURL + '" target="_blank">data</a>';
    var name = getSetting('_authorName');
    var url = getSetting('_authorURL');

    if (name && url) {
      if (url.indexOf('@') > 0) { url = 'mailto:' + url; }
      credit += ' by <a href="' + url + '">' + name + '</a> | ';
    } else if (name) {
      credit += ' by ' + name + ' | ';
    } else {
      credit += ' | ';
    }

    credit += 'View <a href="' + getSetting('_githubRepo') + '">code</a>';
    if (getSetting('_codeCredit')) credit += ' by ' + getSetting('_codeCredit');
    credit += ' with ';
    $('.leaflet-control-attribution')[0].innerHTML = credit + attributionHTML;
  }

});
