import type { InventoryDashboard } from '../../types/dashboard';

const CategoryBreakdown = ({
  categories,
}: {
  categories: InventoryDashboard['byCategory'];
}) => (
  <div className="w-full min-w-0 max-w-full overflow-hidden rounded-md border border-slate-200 bg-white">
    <div className="w-full max-w-full overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-right font-medium">Available</th>
            <th className="px-3 py-2 text-right font-medium">Stale</th>
            <th className="px-3 py-2 text-right font-medium">Never Confirmed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {categories.map((category) => (
            <tr key={category.categoryGroup}>
              <td className="px-3 py-3 font-medium text-slate-900">{category.categoryGroup}</td>
              <td className="px-3 py-3 text-right">{category.total}</td>
              <td className="px-3 py-3 text-right text-emerald-700">{category.available}</td>
              <td className="px-3 py-3 text-right text-amber-700">{category.stale}</td>
              <td className="px-3 py-3 text-right text-red-700">{category.neverConfirmed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default CategoryBreakdown;
