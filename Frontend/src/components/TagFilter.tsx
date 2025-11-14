import { useQuery } from '@tanstack/react-query';
import { getUserTagsByUsernameFn } from '../api/trackerApi';
import { ITag } from '../types';

interface TagFilterProps {
  includedTags: string[];
  excludedTags: string[];
  onIncludeChange: (tagIds: string[]) => void;
  onExcludeChange: (tagIds: string[]) => void;
  username: string; // Username to fetch tags for
}

export default function TagFilter({
  includedTags,
  excludedTags,
  onIncludeChange,
  onExcludeChange,
  username,
}: TagFilterProps) {
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags', username],
    queryFn: () => getUserTagsByUsernameFn(username),
  });

  const toggleInclude = (tagId: string) => {
    // Remove from excluded if present
    if (excludedTags.includes(tagId)) {
      onExcludeChange(excludedTags.filter((id) => id !== tagId));
    }

    // Toggle in included
    if (includedTags.includes(tagId)) {
      onIncludeChange(includedTags.filter((id) => id !== tagId));
    } else {
      onIncludeChange([...includedTags, tagId]);
    }
  };

  const toggleExclude = (tagId: string) => {
    // Remove from included if present
    if (includedTags.includes(tagId)) {
      onIncludeChange(includedTags.filter((id) => id !== tagId));
    }

    // Toggle in excluded
    if (excludedTags.includes(tagId)) {
      onExcludeChange(excludedTags.filter((id) => id !== tagId));
    } else {
      onExcludeChange([...excludedTags, tagId]);
    }
  };

  const clearFilters = () => {
    onIncludeChange([]);
    onExcludeChange([]);
  };

  if (isLoading || tags.length === 0) {
    return null;
  }

  const hasActiveFilters = includedTags.length > 0 || excludedTags.length > 0;
  const activeCount = includedTags.length + excludedTags.length;

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-outline">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
        Tags
        {hasActiveFilters && (
          <span className="badge badge-sm badge-primary">{activeCount}</span>
        )}
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      <div
        tabIndex={0}
        className="dropdown-content menu p-4 shadow-xl bg-base-100 rounded-box w-96 border border-base-300 max-h-[500px] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Filter by Tags</h3>
          {hasActiveFilters && (
            <button className="btn btn-ghost btn-xs" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Include Tags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-base-content/70">
                Include (Show only these)
              </span>
              {includedTags.length > 0 && (
                <span className="text-xs text-base-content/50">
                  {includedTags.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: ITag) => {
                const isIncluded = includedTags.includes(tag._id);
                const isExcluded = excludedTags.includes(tag._id);
                return (
                  <button
                    key={tag._id}
                    type="button"
                    className={`badge cursor-pointer transition-all ${
                      isIncluded
                        ? 'ring-2 ring-offset-2 ring-success'
                        : isExcluded
                          ? 'opacity-30'
                          : 'hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: isIncluded
                        ? tag.color
                        : `${tag.color}20`,
                      border: `2px solid ${tag.color}`,
                      color: isIncluded ? '#fff' : tag.color,
                    }}
                    onClick={() => toggleInclude(tag._id)}
                    disabled={isExcluded}
                  >
                    {tag.name}
                    {isIncluded && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="divider my-2"></div>

          {/* Exclude Tags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-base-content/70">
                Exclude (Hide these)
              </span>
              {excludedTags.length > 0 && (
                <span className="text-xs text-base-content/50">
                  {excludedTags.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: ITag) => {
                const isIncluded = includedTags.includes(tag._id);
                const isExcluded = excludedTags.includes(tag._id);
                return (
                  <button
                    key={tag._id}
                    type="button"
                    className={`badge cursor-pointer transition-all ${
                      isExcluded
                        ? 'ring-2 ring-offset-2 ring-error'
                        : isIncluded
                          ? 'opacity-30'
                          : 'hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: isExcluded
                        ? tag.color
                        : `${tag.color}20`,
                      border: `2px solid ${tag.color}`,
                      color: isExcluded ? '#fff' : tag.color,
                    }}
                    onClick={() => toggleExclude(tag._id)}
                    disabled={isIncluded}
                  >
                    {tag.name}
                    {isExcluded && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
