/**
 * Follow Graph API cursor pagination, aggregating rows up to maxRows.
 * @param {(path: string, params: Record<string, unknown>) => Promise<any>} request
 * @param {string} path
 * @param {Record<string, unknown>} [initialParams]
 * @param {number} [maxRows]
 * @returns {Promise<any[]>}
 */
export async function fetchAllPages(request, path, initialParams = {}, maxRows = Infinity) {
  const rows = [];
  let after = null;

  while (rows.length < maxRows) {
    const pageParams = { ...initialParams };
    if (after) {
      pageParams.after = after;
    }

    const response = await request(path, pageParams);
    const data = Array.isArray(response?.data) ? response.data : [];
    rows.push(...data);

    after = response?.paging?.cursors?.after;
    if (!after) {
      break;
    }
  }

  return rows.length > maxRows ? rows.slice(0, maxRows) : rows;
}
