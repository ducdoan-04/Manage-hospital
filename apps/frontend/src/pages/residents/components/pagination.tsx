type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span>
        Hiển thị {firstItem} - {lastItem} trên tổng số {total} bệnh nhân
      </span>
      <div>
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Trang trước
        </button>
        <strong>
          Trang {page} / {totalPages}
        </strong>
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}
