package com.vex.iot.domain.report.engine;

import com.vex.iot.domain.report.model.ReportResultDTO;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/// 报表 CSV 导出器
/// 职责：将 ReportResultDTO 转换为 CSV 格式并写入 HTTP 响应
@Component
public class ReportCsvExporter {

    /// 将报表结果导出为 CSV 到 HTTP 响应
    public void export(ReportResultDTO result, HttpServletResponse response) throws IOException {
        response.setContentType("text/csv;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=report.csv");

        // UTF-8 BOM
        response.getOutputStream().write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});

        StringBuilder sb = new StringBuilder();
        List<ReportResultDTO.ColumnInfo> columns = result.getColumns();

        // 写表头
        if (columns != null && !columns.isEmpty()) {
            for (int i = 0; i < columns.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append(columns.get(i).getDisplayName() != null
                        ? columns.get(i).getDisplayName() : columns.get(i).getAlias());
            }
            sb.append("\r\n");
        }

        // 写数据行
        if (result.getRows() != null && columns != null) {
            for (var row : result.getRows()) {
                boolean first = true;
                for (var col : columns) {
                    if (!first) sb.append(',');
                    Object val = row.get(col.getAlias());
                    String str = val == null ? "" : String.valueOf(val);
                    if (str.contains(",") || str.contains("\"") || str.contains("\n")) {
                        str = str.replace("\"", "\"\"");
                        str = "\"" + str + "\"";
                    }
                    sb.append(str);
                    first = false;
                }
                sb.append("\r\n");
            }
        }

        response.getOutputStream().write(sb.toString().getBytes(StandardCharsets.UTF_8));
        response.getOutputStream().flush();
    }
}