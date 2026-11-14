-- SCRUM-7: customers rate delivered orders (1-5 stars + optional comment).
-- One rating per order; ratings are never edited or deleted.

CREATE SEQUENCE foodme.rating_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE foodme.rating (
    id BIGINT NOT NULL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES foodme."order"(id),
    customer_id BIGINT NOT NULL REFERENCES foodme.customer(id),
    chef_id BIGINT NOT NULL REFERENCES foodme.chef(id),
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment VARCHAR(1000),
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_rating_chef_id ON foodme.rating(chef_id);
CREATE INDEX idx_rating_customer_id ON foodme.rating(customer_id);
