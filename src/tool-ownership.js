export const toolOwnerships={own:'우리 공구',hq:'본사 물량',unknown:'미분류'};
export const toolOwnership=data=>Object.hasOwn(toolOwnerships,data?.ownership)?data.ownership:'unknown';
export const toolOwnershipLabel=data=>toolOwnerships[toolOwnership(data)];
export const filterToolsByOwnership=(rows,ownership='')=>ownership?rows.filter(r=>toolOwnership(r.data)===ownership):rows;
