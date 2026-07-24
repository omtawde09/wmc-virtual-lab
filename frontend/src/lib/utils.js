/**
 * Joins class names, ignoring falsy values.
 *
 * The usual `cn` is clsx + tailwind-merge; this project does not use Tailwind,
 * so conflicting-class merging has nothing to resolve and plain joining is the
 * whole job.
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
