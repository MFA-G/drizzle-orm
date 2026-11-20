import { expect, test } from 'vitest';
import { drizzle as betterSQLite3Drizzle } from '~/better-sqlite3';
import { aliasedTable, eq, sql } from '~/index';
import { drizzle } from '~/node-postgres';
import { integer, pgTable, pgView, text } from '~/pg-core';
import { integer as sqliteInteger, sqliteTable, sqliteView, text as sqliteText } from '~/sqlite-core';

const airports = pgTable('airports', {
	id: integer().primaryKey(),
	code: text().notNull(),
});

const flights = pgTable('flights', {
	id: integer().primaryKey(),
	originId: integer('origin_id').notNull(),
	destinationId: integer('destination_id').notNull(),
});

const airportView = pgView('airport_view').as((qb) =>
	qb
		.select({
			id: airports.id,
			code: sql`upper(${airports.code})`.as('code'),
		})
		.from(airports)
);

// https://github.com/drizzle-team/drizzle-orm/issues/6703
test('a selection field of an aliased view is qualified with the alias', () => {
	const db = drizzle.mock();
	const destination = aliasedTable(airportView, 'destination');

	const query = db
		.select({
			flightId: flights.id,
			originCode: airportView.code,
			destinationId: destination.id,
			destinationCode: destination.code,
		})
		.from(flights)
		.innerJoin(airportView, eq(airportView.id, flights.originId))
		.innerJoin(destination, eq(destination.id, flights.destinationId));

	expect(query.toSQL().sql).toStrictEqual(
		`select "flights"."id", "airport_view"."code", "destination"."id", "destination"."code" from "flights" inner join "airport_view" on "airport_view"."id" = "flights"."origin_id" inner join "airport_view" "destination" on "destination"."id" = "flights"."destination_id"`,
	);
});

test('a filter on a selection field of an aliased view is qualified with the alias', () => {
	const db = drizzle.mock();
	const destination = aliasedTable(airportView, 'destination');

	const query = db.select().from(destination).where(eq(destination.code, 'SEA'));

	expect(query.toSQL().sql).toStrictEqual(
		`select "id", "code" from "airport_view" "destination" where "destination"."code" = $1`,
	);
});

test('a whole-view selection of an aliased view is qualified with the alias', () => {
	const db = drizzle.mock();
	const destination = aliasedTable(airportView, 'destination');

	const query = db
		.select()
		.from(flights)
		.innerJoin(destination, eq(destination.id, flights.destinationId))
		.orderBy(destination.code);

	expect(query.toSQL().sql).toStrictEqual(
		`select "flights"."id", "flights"."origin_id", "flights"."destination_id", "destination"."id", "destination"."code" from "flights" inner join "airport_view" "destination" on "destination"."id" = "flights"."destination_id" order by "destination"."code"`,
	);
});

test('a selection field of an unaliased view keeps the view name as its origin', () => {
	const db = drizzle.mock();

	const query = db
		.select({ originCode: airportView.code })
		.from(flights)
		.innerJoin(airportView, eq(airportView.id, flights.originId));

	expect(query.toSQL().sql).toStrictEqual(
		`select "airport_view"."code" from "flights" inner join "airport_view" on "airport_view"."id" = "flights"."origin_id"`,
	);
});

const sqliteAirports = sqliteTable('airports', {
	id: sqliteInteger().primaryKey(),
	code: sqliteText().notNull(),
});

const sqliteFlights = sqliteTable('flights', {
	id: sqliteInteger().primaryKey(),
	originId: sqliteInteger('origin_id').notNull(),
	destinationId: sqliteInteger('destination_id').notNull(),
});

const sqliteAirportView = sqliteView('airport_view').as((qb) =>
	qb
		.select({
			id: sqliteAirports.id,
			code: sql`upper(${sqliteAirports.code})`.as('code'),
		})
		.from(sqliteAirports)
);

test('an aliased view is joined under its original name in SQLite', () => {
	const db = betterSQLite3Drizzle.mock();
	const destination = aliasedTable(sqliteAirportView, 'destination');

	const query = db
		.select({
			flightId: sqliteFlights.id,
			originCode: sqliteAirportView.code,
			destinationId: destination.id,
			destinationCode: destination.code,
		})
		.from(sqliteFlights)
		.innerJoin(sqliteAirportView, eq(sqliteAirportView.id, sqliteFlights.originId))
		.innerJoin(destination, eq(destination.id, sqliteFlights.destinationId));

	expect(query.toSQL().sql).toStrictEqual(
		`select "flights"."id", "airport_view"."code", "destination"."id", "destination"."code" from "flights" inner join "airport_view" on "airport_view"."id" = "flights"."origin_id" inner join "airport_view" "destination" on "destination"."id" = "flights"."destination_id"`,
	);
});
