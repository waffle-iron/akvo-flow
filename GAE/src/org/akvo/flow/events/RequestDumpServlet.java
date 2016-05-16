package org.akvo.flow.events;

import static javax.servlet.http.HttpServletResponse.SC_CREATED;

import java.io.IOException;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.codehaus.jackson.map.ObjectMapper;

// FIXME: Delete me
public class RequestDumpServlet extends HttpServlet {

    private static final long serialVersionUID = 1713528023785104411L;
    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();
    private static final Logger log = Logger.getLogger(RequestDumpServlet.class.getName());

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        log.log(Level.INFO, JSON_MAPPER.readTree(req.getInputStream()).toString());

        resp.setStatus(SC_CREATED);
    }

}
