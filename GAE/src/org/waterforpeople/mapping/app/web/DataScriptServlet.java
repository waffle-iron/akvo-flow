package org.waterforpeople.mapping.app.web;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Writer;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class DataScriptServlet extends HttpServlet {

    private static final long serialVersionUID = 5120388039537608848L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        DataScriptBinding flow = new DataScriptBinding();
        ScriptEngineManager em = new ScriptEngineManager();
        ScriptEngine engine = em.getEngineByName("js");
        engine.put("FLOW", flow);

        String line;
        StringBuffer sb = new StringBuffer();
        BufferedReader reader = req.getReader();
        while ((line = reader.readLine()) != null) {
            sb.append(line);
        }

        try {
            Object result = engine.eval(sb.toString());
            Writer w = resp.getWriter();
            if (result != null) {
                w.write(result.toString());
            }
            w.write("\n");
        } catch (ScriptException e) {
            e.printStackTrace();
        }
    }

}
