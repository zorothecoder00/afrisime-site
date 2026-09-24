// Instance partagée de la base pour le code serveur d'Astro (pages, API, middleware).
import { DATABASE_URL } from 'astro:env/server';
import { createDb } from '../db/client';

export const db = createDb(DATABASE_URL);
