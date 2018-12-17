DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS yelps;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS meetups;
DROP TABLE IF EXISTS trails;
DROP TABLE IF EXISTS locations;

CREATE TABLE locations ( 
  id SERIAL PRIMARY KEY, 
  search_query VARCHAR(255), 
  formatted_query VARCHAR(255), 
  latitude NUMERIC(8, 6), 
  longitude NUMERIC(9, 6),
  created_at CHAR(15)
);

CREATE TABLE weathers ( 
  id SERIAL PRIMARY KEY, 
  forecast VARCHAR(255), 
  time VARCHAR(255), 
  created_at CHAR(15),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE yelps ( 
  id SERIAL PRIMARY KEY, 
  name VARCHAR(255), 
  price CHAR(5),
  rating NUMERIC(2,1),
  url VARCHAR(500), 
  created_at CHAR(15),
  location_id INTEGER NOT NULL
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE movies (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  overview TEXT,
  average_votes REAL,
  total_votes INTEGER,
  image_url VARCHAR(255),
  popularity NUMERIC(6,4),
  released_on CHAR(10),
  created_at CHAR(15),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE meetups (
  id SERIAL PRIMARY KEY, 
  link VARCHAR(255), 
  name VARCHAR(255), 
  creation_date CHAR(15), 
  host VARCHAR(255), 
  created_at CHAR(15),
  location_id INTEGER NOT NULL REFERENCES locations(id) 
);

CREATE TABLE trails (
  id SERIAL PRIMARY KEY, 
  name VARCHAR(255), 
  location VARCHAR(255),
  length NUMERIC(4,2),
  stars NUMERIC(2,1),
  star_votes INTEGER,
  summary VARCHAR(255),
  trail_url VARCHAR(255),
  conditions VARCHAR(255),
  condition_date CHAR(15),
  condition_time CHAR(15),
  created_at CHAR(15),
  location_id INTEGER NOT NULL REFERENCES locations(id)
);