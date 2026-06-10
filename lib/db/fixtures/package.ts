import type { FixturePackage } from "./types";
import { stat201Summer2026 } from "./courses/stat-201-summer-2026";
import { hist310Summer2026 } from "./courses/hist-310-summer-2026";
import { cs152Summer2026 } from "./courses/cs-152-summer-2026";
import { bio110Summer2026 } from "./courses/bio-110-summer-2026";
import { writ105Summer2026 } from "./courses/writ-105-summer-2026";
import { stat405Summer2026 } from "./courses/stat-405-summer-2026";
import { stat201Fall2025 } from "./courses/stat-201-fall-2025";
import { hist209Fall2025 } from "./courses/hist-209-fall-2025";
import { cs250Spring2026 } from "./courses/cs-250-spring-2026";

export const demoPackage: FixturePackage = {
  org: {
    name: "Demo University",
    slug: "demo-u",
  },

  password: "atlas1234",

  terms: [
    {
      slug: "fall-2025",
      name: "Fall 2025",
      startsAt: "2025-09-01",
      endsAt: "2025-12-19",
    },
    {
      slug: "spring-2026",
      name: "Spring 2026",
      startsAt: "2026-01-20",
      endsAt: "2026-04-24",
    },
    {
      slug: "summer-2026",
      name: "Summer 2026",
      startsAt: "2026-04-27",
      endsAt: "2026-07-31",
      current: true,
    },
  ],

  users: [
    // Admin
    {
      key: "admin",
      name: "Dr. Elena Vance",
      email: "admin@demo.edu",
      role: "admin",
    },

    // Instructors
    {
      key: "torres",
      name: "Prof. Alan Torres",
      email: "instructor@demo.edu",
      role: "instructor",
    },
    {
      key: "chen-wei",
      name: "Prof. Wei Chen",
      email: "chenwei@demo.edu",
      role: "instructor",
    },
    {
      key: "kwame",
      name: "Prof. Kwame Asante",
      email: "kasante@demo.edu",
      role: "instructor",
    },
    {
      key: "amara",
      name: "Dr. Amara Osei",
      email: "aosei@demo.edu",
      role: "instructor",
    },
    {
      key: "diaz",
      name: "Prof. Carmen Diaz",
      email: "cdiaz@demo.edu",
      role: "instructor",
    },

    // Students
    {
      key: "maya",
      name: "Maya Patel",
      email: "student@demo.edu",
      role: "student",
    },
    {
      key: "liam",
      name: "Liam Okafor",
      email: "lokafor@demo.edu",
      role: "student",
    },
    {
      key: "sofia",
      name: "Sofia Reyes",
      email: "sreyes@demo.edu",
      role: "student",
    },
    {
      key: "derek",
      name: "Derek Hutchins",
      email: "dhutchins@demo.edu",
      role: "student",
    },
    {
      key: "priya",
      name: "Priya Nair",
      email: "pnair@demo.edu",
      role: "student",
    },
    {
      key: "jose",
      name: "Jose Morales",
      email: "jmorales@demo.edu",
      role: "student",
    },
    {
      key: "anna",
      name: "Anna Kowalski",
      email: "akowalski@demo.edu",
      role: "student",
    },
    {
      key: "malik",
      name: "Malik Thompson",
      email: "mthompson@demo.edu",
      role: "student",
    },
    {
      key: "chen",
      name: "Chen Liu",
      email: "cliu@demo.edu",
      role: "student",
    },
    {
      key: "fatima",
      name: "Fatima Al-Hassan",
      email: "falhassan@demo.edu",
      role: "student",
    },
    {
      key: "oscar",
      name: "Oscar Lindqvist",
      email: "olindqvist@demo.edu",
      role: "student",
    },
    {
      key: "rachel",
      name: "Rachel Kim",
      email: "rkim@demo.edu",
      role: "student",
    },
    {
      key: "noah",
      name: "Noah Abebe",
      email: "nabebe@demo.edu",
      role: "student",
    },
    {
      key: "isabel",
      name: "Isabel Ferreira",
      email: "iferreira@demo.edu",
      role: "student",
    },
    {
      key: "sam",
      name: "Sam Nguyen",
      email: "snguyen@demo.edu",
      role: "student",
    },
  ],

  courses: [
    // Summer 2026 (current) — 6 courses
    stat201Summer2026,
    hist310Summer2026,
    cs152Summer2026,
    bio110Summer2026,
    writ105Summer2026,
    stat405Summer2026,
    // Fall 2025 (archived) — 2 courses
    stat201Fall2025,
    hist209Fall2025,
    // Spring 2026 (archived) — 1 course
    cs250Spring2026,
  ],
};
