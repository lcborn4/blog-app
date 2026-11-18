import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { BlogApiService, BlogPost, postedDayDiffers } from './blog-api.service';

export type BlogSort = 'event-desc' | 'event-asc' | 'published-desc' | 'published-asc';

export interface ArchiveMonth {
  key: string; // YYYY-MM
  label: string;
  count: number;
}

export interface ArchiveYear {
  year: string;
  count: number;
  months: ArchiveMonth[];
}

export interface PostGroup {
  key: string; // YYYY or YYYY-MM
  label: string;
  posts: BlogPost[];
}

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

@Component({
  standalone: true,
  selector: 'app-blog',
  imports: [RouterLink, DatePipe],
  templateUrl: './blog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./blog.component.css']
})
export class BlogComponent implements OnInit {
  private readonly api = inject(BlogApiService);

  readonly siteHomeUrl = environment.siteHomeUrl;
  readonly siteHomeLabel = environment.siteHomeLabel || environment.siteName;

  readonly posts = signal<BlogPost[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly sort = signal<BlogSort>('event-desc');
  readonly rangeFrom = signal('');
  readonly rangeTo = signal('');
  readonly filtersOpen = signal(false);
  /** Selected archive nav: '' = all, '2025', or '2025-07' */
  readonly archiveFocus = signal('');

  readonly sortOptions: { value: BlogSort; label: string }[] = [
    { value: 'event-desc', label: 'Event date · newest' },
    { value: 'event-asc', label: 'Event date · oldest' },
    { value: 'published-desc', label: 'Published · newest' },
    { value: 'published-asc', label: 'Published · oldest' }
  ];

  readonly hasRange = computed(() => !!(this.rangeFrom() || this.rangeTo()));

  readonly filtersActive = computed(
    () => this.hasRange() || this.sort() !== 'event-desc'
  );

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  /** Years/months built from all posts (not filtered), like GitHub's year rail */
  readonly archive = computed((): ArchiveYear[] => {
    const counts = new Map<string, number>();
    for (const post of this.posts()) {
      const date = post.eventDate || '';
      if (!/^\d{4}-\d{2}/.test(date)) continue;
      const year = date.slice(0, 4);
      const month = date.slice(0, 7);
      counts.set(year, (counts.get(year) || 0) + 1);
      counts.set(month, (counts.get(month) || 0) + 1);
    }

    const years = [...counts.keys()]
      .filter((k) => /^\d{4}$/.test(k))
      .sort((a, b) => b.localeCompare(a));

    return years.map((year) => {
      const months = [...counts.keys()]
        .filter((k) => k.startsWith(`${year}-`))
        .sort((a, b) => b.localeCompare(a))
        .map((key) => {
          const monthIndex = Number(key.slice(5, 7)) - 1;
          return {
            key,
            label: MONTH_LABELS[monthIndex] || key.slice(5),
            count: counts.get(key) || 0
          };
        });
      return {
        year,
        count: counts.get(year) || 0,
        months
      };
    });
  });

  readonly filteredPosts = computed(() => {
    const mode = this.sort();
    const from = this.rangeFrom();
    const to = this.rangeTo();
    const focus = this.archiveFocus();

    const list = this.posts().filter((p) => {
      const date = p.eventDate || '';
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (focus) {
        if (focus.length === 4 && !date.startsWith(focus)) return false;
        if (focus.length === 7 && !date.startsWith(focus)) return false;
      }
      return true;
    });

    const key = (p: BlogPost): string => {
      if (mode.startsWith('published')) {
        return p.publishedAt || p.eventDate || '';
      }
      return p.eventDate || '';
    };

    return [...list].sort((a, b) => {
      const cmp = key(a).localeCompare(key(b));
      return mode.endsWith('-desc') ? -cmp : cmp;
    });
  });

  /** Group filtered posts by month for timeline headings */
  readonly groupedPosts = computed((): PostGroup[] => {
    const mode = this.sort();
    const ascending = mode.endsWith('-asc');
    const groups = new Map<string, BlogPost[]>();

    for (const post of this.filteredPosts()) {
      const date = post.eventDate || '';
      const key = /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(post);
    }

    const keys = [...groups.keys()].sort((a, b) =>
      ascending ? a.localeCompare(b) : b.localeCompare(a)
    );

    return keys.map((key) => {
      if (key === 'unknown') {
        return { key, label: 'Undated', posts: groups.get(key)! };
      }
      const year = key.slice(0, 4);
      const monthIndex = Number(key.slice(5, 7)) - 1;
      return {
        key,
        label: `${MONTH_LABELS[monthIndex] || key.slice(5)} ${year}`,
        posts: groups.get(key)!
      };
    });
  });

  ngOnInit(): void {
    this.api.listPublished().subscribe({
      next: (res) => {
        this.posts.set(res.posts);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Could not load posts');
        this.loading.set(false);
      }
    });
  }

  setSort(value: BlogSort): void {
    this.sort.set(value);
  }

  setRangeFrom(value: string): void {
    this.rangeFrom.set(value);
  }

  setRangeTo(value: string): void {
    this.rangeTo.set(value);
  }

  clearRange(): void {
    this.rangeFrom.set('');
    this.rangeTo.set('');
  }

  selectAll(): void {
    this.archiveFocus.set('');
  }

  selectYear(year: string): void {
    this.archiveFocus.set(year);
    this.scrollToArchive(year);
  }

  selectMonth(monthKey: string): void {
    this.archiveFocus.set(monthKey);
    this.scrollToArchive(monthKey);
  }

  isYearActive(year: string): boolean {
    const focus = this.archiveFocus();
    return focus === year || focus.startsWith(`${year}-`);
  }

  isMonthActive(monthKey: string): boolean {
    return this.archiveFocus() === monthKey;
  }

  postedDiffers(post: BlogPost): boolean {
    return postedDayDiffers(post.eventDate, post.publishedAt);
  }

  private scrollToArchive(key: string): void {
    // Defer until filtered groups render
    queueMicrotask(() => {
      const el =
        key.length === 4
          ? document.querySelector<HTMLElement>(`[data-archive-year="${key}"]`)
          : document.getElementById(`archive-${key}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}
