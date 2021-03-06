'use strict'

// Application Dependencies
const express = require('express')
const cors = require('cors')
const superagent = require('superagent')
const pg = require('pg');

// Load env vars;
require('dotenv').config()

const PORT = process.env.PORT || 3000

// App
const app = express()

app.use(cors());

// Postgres
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// Error handling
function handleError (err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry something went wrong!')
}

// Timeouts
const timeouts = {
  weather: 15 * 1000, // 15 seconds
  yelp: 7 * 60 * 60 * 24 * 1000, // 7 days
  movie: 60 * 60 * 24 * 1000, // 24 hours
  meetup: 60 * 60 * 24 * 1000, // 24 hours
  trail: 60 * 60 * 1000 // 1 hour
}

// Routes
app.get('/location', getLocation)
app.get('/weather', getWeather)
app.get('/yelp', getYelp);
app.get('/movies', getMovies);
app.get('/meetups', getMeetups);
app.get('/trails', getTrails);


// Handlers
function getLocation (req, res) {
  Location.lookup({
    tableNmae: Location.tableName,

    query: req.query.data,

    cacheHit: function(result) {
      res.send(result.rows[0]);
    },

    cacheMiss: function() {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${this.query}&key=${process.env.GEOCODE_API_KEY}`;

      return superagent.get(url)
        .then(result => {
          const location = new Location(this.query, result.body.results[0]);
          location.save()
            .then(location => res.send(location));
        })
        .catch(err => handleError(err, res));
    }
  })
}

function getWeather (req, res) {
  const weatherOptions = {
    tableName: Weather.tableName,

    location: req.query.data.id,

    timeout: timeouts.weather,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      const url = `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;

      superagent.get(url)
        .then(results => {
          const weatherSummaries = results.body.daily.data.map(day => {
            const summary = new Weather(day);
            summary.save(req.query.data.id);
            return summary;
          });
          res.send(weatherSummaries);
        })
        .catch(err => handleError(err, res));
    }
  };
  Weather.lookup(weatherOptions);
}

function getYelp(req, res) {
  const yelpOptions = {
    tableName: Yelp.tableName,

    location: req.query.data.id,

    timeout: timeouts.yelp,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      const url = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${req.query.data.latitude}&longitude=${req.query.data.longitude}`;

      superagent.get(url)
        .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
        .then(results => {
          const yelpSummaries = results.body.businesses.map(business => {
            const summary = new Yelp(business);
            summary.save(req.query.data.id);
            return summary;
          });
          res.send(yelpSummaries);
        })
        .catch(err => handleError(err, res));
    }
  };
  Yelp.lookup(yelpOptions);
}

function getMovies(req, res) {
  const movieOptions = {
    tableName: Movie.tableName,

    location: req.query.data.id,

    timeout: timeouts.movie,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${req.query.data.search_query}`;

      superagent.get(url)
        .then(results => {
          const movieSummaries = results.body.results.map(movie => {
            const summary = new Movie(movie);
            summary.save(req.query.data.id);
            return summary;
          });
          res.send(movieSummaries);
        })
        .catch(err => handleError(err, res));
    }
  };
  Movie.lookup(movieOptions);
}

function getMeetups(req, res) {
  const meetupOptions = {
    tableName: Meetup.tableName,

    location: req.query.data.id,

    timeout: timeouts.meetup,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      const url = `https://api.meetup.com/find/groups?location=${req.query.data.search_query}&page=20&key=${process.env.MEETUP_API_KEY}`;

      superagent.get(url)
        .then(results => {
          const meetupSummaries = results.body.map(meetup => {
            const summary = new Meetup(meetup);
            summary.save(req.query.data.id);
            return summary;
          });
          res.send(meetupSummaries);
        })
        .catch(err => handleError(err, res));
    }
  };
  Meetup.lookup(meetupOptions);
}

function getTrails(req, res) {
  const trailOptions = {
    tableName: Trail.tableName,

    location: req.query.data.id,

    timeout: timeouts.trail,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      const url = `https://www.hikingproject.com/data/get-trails?lat=${req.query.data.latitude}&lon=${req.query.data.longitude}&key=${process.env.TRAILS_API_KEY}`;

      superagent.get(url)
        .then(results => {
          const trailSummaries = results.body.trails.map(trail => {
            const summary = new Trail(trail);
            summary.save(req.query.data.id);
            return summary;
          });
          res.send(trailSummaries);
        })
        .catch(err => handleError(err, res));
    }
  };
  Trail.lookup(trailOptions);
}


// General lookup function for everything besides location
function lookup(options) {
  const SQL = `SELECT * FROM ${options.tableName} WHERE location_id=$1;`;
  const values = [options.location];

  client.query(SQL, values)
    .then(result => {
      if (result.rowCount > 0) {
        if (Date.now() - result.rows[0].created_at > options.timeout) {
          deleteRows(options);
        } else {
          options.cacheHit(result);
        }
      } else {
        options.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

// General delete function
function deleteRows(options) {
  const SQL = `DELETE FROM ${options.tableName} WHERE location_id=$1;`;
  const values = [options.location];
  console.log(`cache invalid - deleting rows in ${options.tableName}`)

  client.query(SQL, values)
    .then(() => {
      options.cacheMiss();
    })
    .catch(err => handleError(err));
}


// Models
function Location (query, location) {
  this.search_query = query
  this.formatted_query = location.formatted_address
  this.latitude = location.geometry.location.lat
  this.longitude = location.geometry.location.lng
}
Location.tableName = 'locations';
Location.lookup = location => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [location.query];

  return client.query(SQL, values)
    .then(result => {
      if(result.rowCount > 0) {
        location.cacheHit(result);
      } else {
        location.cacheMiss();
      }
    })
    .catch(err => handleError(err));
}
Location.prototype = {
  save: function() {
    const SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id;`;
    const values = [this.search_query, this.formatted_query, this.latitude, this.longitude, Date.now()];

    return client.query(SQL, values)
      .then(result => {
        this.id = result.rows[0].id;
        return this;
      });
  }
}

function Weather (day) {
  this.forecast = day.summary
  this.time = new Date(day.time * 1000).toDateString()
}
Weather.tableName = 'weathers';
Weather.lookup = lookup;
Weather.prototype = {
  save: function(location_id) {
    const SQL = `INSERT INTO ${Weather.tableName} (forecast, time, created_at, location_id) VALUES ($1, $2, $3, $4);`;
    const values = [this.forecast, this.time, Date.now(), location_id];

    client.query(SQL, values);
  }
}

function Yelp(business) {
  this.name = business.name;
  this.image_url = business.image_url;
  this.price = business.price;
  this.rating = business.rating;
  this.url = business.url;
}
Yelp.tableName = 'yelps';
Yelp.lookup = lookup;
Yelp.prototype = {
  save: function(location_id) {
    const SQL = `INSERT INTO ${Yelp.tableName} (name, price, rating, url, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
    const values = [this.name, this.price, this.rating, this.url, Date.now(), location_id];

    client.query(SQL, values);
  }
}

function Movie(movie) {
  this.title = movie.title;
  this.overview = movie.overview;
  this.average_votes = movie.vote_average;
  this.total_votes = movie.vote_count;
  if (movie.poster_path) {
    this.image_url = `http://image.tmdb.org/t/p/w200_and_h300_bestv2${movie.poster_path}`;
  } else {
    this.image_url = null;
  }
  this.popularity = movie.popularity;
  this.released_on = movie.release_date;
}
Movie.tableName = 'movies';
Movie.lookup = lookup;
Movie.prototype = {
  save: function(location_id) {
    const SQL = `INSERT INTO ${Movie.tableName} (title, overview, average_votes, total_votes, image_url, popularity, released_on, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
    const values = [this.title, this.overview, this.average_votes, this.total_votes, this.image_url, this.popularity, this.released_on, Date.now(), location_id];

    client.query(SQL, values);
  }
}

function Meetup(meetup) {
  this.link = meetup.link;
  this.name = meetup.name;
  this.creation_date = new Date(meetup.created).toDateString();
  this.host = meetup.organizer.name;
}
Meetup.tableName = 'meetups';
Meetup.lookup = lookup;
Meetup.prototype = {
  save: function(location_id) {
    const SQL = `INSERT INTO ${Meetup.tableName} (link, name, creation_date, host, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
    const values = [this.link, this.name, this.creation_date, this.host, Date.now(), location_id];
    client.query(SQL, values);
  }
}

function Trail(trail) {
  this.name = trail.name;
  this.location = trail.location;
  this.length = trail.length;
  this.stars = trail.stars;
  this.star_votes = trail.starVotes;
  this.summary = trail.summary;
  this.trail_url = trail.url;
  this.conditions = trail.conditionStatus;
  this.condition_date = trail.conditionDate.split(' ')[0];
  this.condition_time = trail.conditionDate.split(' ')[1];
}
Trail.tableName = 'trails';
Trail.lookup = lookup;
Trail.prototype = {
  save: function(location_id) {
    const SQL = `INSERT INTO ${Trail.tableName} (name, location, length, stars, star_votes, summary, trail_url, conditions, condition_date, condition_time, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`;
    const values = [this.name, this.location, this.length, this.stars, this.star_votes, this.summary, this.trail_url, this.conditions, this.condition_date, this.condition_time, Date.now(), location_id];

    client.query(SQL, values);
  }
}


// Bad path
app.get('/*', function(req, res) {
  res.status(404).send('You are in the wrong place');
});

// Listen
app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`)
 }
)
