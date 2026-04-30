package com.planilhaautomatizada.rest.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {

    //metodo "GET" para retornar 'string index, para fazer o thymeleaf funcionar, e retornar a pagina index.html

    @GetMapping("/")
    public String index() {
        return "index";
    }
}

