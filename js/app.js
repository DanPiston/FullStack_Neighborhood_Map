const client_id = "F1OAP3TOGKR1HGKPVHV44NOZXRY0XSIA45MCUEWRZ13EJW43";
const client_secret = "MQFJB1QUTLDXAW3PSYUCSEUAJ2GVIXJDSBZNTBURJFQWCPHM";
const listsUrl = "https://api.foursquare.com/v2/lists/5a6cc7dbdd8442362ecde70a?" +"&client_id=" + client_id +"&client_secret=" + client_secret +"&v=20180130";

let Place = function(data) {
  let self = this;

  this.name = data.name;
  this.rating = data.rating;
  this.address = data.address;
  this.placeData = data.placeData;
  this.visible = ko.observable(true);
  this.marker = data.marker;

  this.info = ko.computed(function() {
    let output = '<div class="info-window">';
    output += '<p class="window-name">' + self.name + "</p>";
    output += '<p class="window-address">' + self.address + "</p>";
    output +=
      '<p class="window-rating">4Square Rating: ' + self.rating + "</p>";
    output += "</div>";
    return output;
  });
};

let MapViewModel = function() {
  let self = this;

  this.neighborhood, this.map, this.infoWindow, this.mapBounds;

  this.places = ko.observableArray([]);
  this.currentPlace = ko.observable();
  this.sortedPlaces = ko.computed(function() {
    let unsortedPlaces = self.places().slice();
    unsortedPlaces.sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });
    return unsortedPlaces;
  });

  this.placesListOpen = ko.observable(true);
  this.toggleButtonText = ko.computed(function() {
    if (self.placesListOpen()) {
      return "Hide List";
    } else {
      return "Show List";
    }
  });
  this.placesListClass = ko.computed(function() {
    if (self.placesListOpen()) {
      return "open";
    } else {
      return "closed";
    }
  });

  this.filterQuery = ko.observable("");
  this.filterWords = ko.computed(function() {
    return self
      .filterQuery()
      .toLowerCase()
      .split(" ");
  });

  this.init = function() {
    this.neightborhood = new google.maps.LatLng(40.3262227, -75.3457161);
    let mapOptions = {
      disableDefaultUI: true,
      center: this.neightborhood
    };

    // The following makes the let `map` a new Google Map JavaScript Object and attaches it to
    // <div id="map">
    this.map = new google.maps.Map(document.getElementById("map"), mapOptions);

    this.loadPlaces();

    window.addEventListener("resize", function(e) {
      // Resizing the map
      self.map.fitBounds(self.mapBounds);
    });

    google.maps.event.addListener(self.infoWindow, "closeclick", function() {
      self.currentPlace(null);
      self.resetCenter();
    });
  };

  this.loadPlaces = function() {
    self.infoWindow = new google.maps.InfoWindow();
    self.mapBounds = new google.maps.LatLngBounds();
    // Creating a Google Place search object.  This will handle the work of finding location data
    let service = new google.maps.places.PlacesService(self.map);

    // AJAX call to build list of places from 4Square
    $.getJSON(listsUrl)
     .done(
      // Take information and build markers for each venue
      function (results) {
        let locations = results.response.list.listItems.items;
        locations.forEach(function(place) {
          let restName = place.venue.name;
          let restAddress = place.venue.location.formattedAddress.toString();
          let restRating = place.venue.rating;
          let request = { query: restAddress };
          service.textSearch(request, function(results, status) {
            if (status == google.maps.places.PlacesServiceStatus.OK) {
              self.addMarker(restName, restRating, restAddress, results[0]);
            }
          });
        });
      })
     .fail(function( jqxhr, textStatus, error) {
       var err = textStatus + ", " + error;
       alert("4Square Request failed: " + err);
     });
  };

  this.addMarker = function(name, rating, address, placeData) {
    // The next lines save location data from the search result object to local letiables
    let lat = placeData.geometry.location.lat(); // latitude from the place service
    let lon = placeData.geometry.location.lng(); // longitude from the place service

    let marker = new google.maps.Marker({
      map: self.map,
      position: placeData.geometry.location,
      rating: rating,
      animation: google.maps.Animation.DROP,
      id: name
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 15)
    });

    google.maps.event.addListener(marker, "click", function() {
      $("#" + marker.id).trigger("click");
      if (marker.getAnimation() !== null) {
        marker.setAnimation(null);
      } else {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(function() {
          marker.setAnimation(null);
        }, 750);
      }
    });

    // this is where the pin actually gets added to the map.
    // bounds.extend() takes in a map location object
    self.mapBounds.extend(new google.maps.LatLng(lat, lon));
    // fit the map to the new marker
    self.map.fitBounds(self.mapBounds);
    // center the map and
    // fit the map to the new marker
    self.resetCenter();

    self.places.push(
      new Place({
        name: name,
        rating: rating,
        address: address,
        placeData: placeData,
        visible: ko.observable(true),
        marker: marker
      })
    );
  };

  this.displayInfo = function(place) {
    self.infoWindow.close();
    // infoWindows are the little helper windows that open when you click
    // or hover over a pin on a map. They usually contain more information
    // about a location.
    self.infoWindow.setContent(place.info());

    self.infoWindow.open(self.map, place.marker);

    self.map.panTo(place.marker.position);
  };

  this.filterSubmit = function() {
    self.filterWords().forEach(function(word) {
      self.places().forEach(function(place) {
        let name = place.name.toLowerCase();
        let address = place.address.toLowerCase();

        if (name.indexOf(word) === -1 && address.indexOf(word) === -1) {
          place.visible(false);
          place.marker.setMap(null);
        } else {
          place.visible(true);
          place.marker.setMap(self.map);
        }
      });
    });
    self.filterQuery("");
  };

  this.togglePlacesList = function() {
    self.placesListOpen(!self.placesListOpen());
  };

  this.setCurrentPlace = function(place) {
    if (self.currentPlace() !== place) {
      self.currentPlace(place);
      self.displayInfo(place);
    } else {
      self.currentPlace(null);
      self.infoWindow.close();
      self.resetCenter();
    }
  };

  this.resetCenter = function() {
    self.map.fitBounds(self.mapBounds);
    self.map.panTo(self.mapBounds.getCenter());
  };

  this.init();
};

$(ko.applyBindings(new MapViewModel()));
